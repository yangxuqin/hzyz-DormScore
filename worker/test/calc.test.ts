// 计算引擎单元测试：用例全部取自 1.md 的业务示例
import { describe, expect, it } from 'vitest';
import { computeDaily } from '../src/calc/daily';
import { computePersonalMonthly, computePersonalShare } from '../src/calc/personal';
import { computeFrequency } from '../src/calc/frequency';
import { computeOverview } from '../src/calc/overview';
import { monthCalendar } from '../src/calc/calendar';
import { disciplineRecords } from '../src/calc/discipline';
import {
  dailyTrend,
  monthlyTrend,
  monthKeysWithRecords,
  rateOf,
  round2,
  weeklyTrend,
} from '../src/calc/trends';
import { makeRecord, CONFIG } from './fixtures';

describe('computeDaily 单日扣分与得分', () => {
  it('空记录：0 扣分，20 分', () => {
    const d = computeDaily(makeRecord());
    expect(d).toEqual({
      bedDeduction: 0,
      publicDeduction: 0,
      disciplineDeduction: 0,
      talkCount: 0,
      totalDeduction: 0,
      score: 20,
    });
  });

  it('1.md §18：上午床位2+公共1+讲话1，下午床位4+公共2 → 总扣 11，得分 9', () => {
    const record = makeRecord({
      talkAm: 1,
      talkPm: 0,
      bedChecks: [
        { period: 'AM', bedId: 1, item: 'BED' },
        { period: 'PM', bedId: 1, item: 'BED' },
        { period: 'PM', bedId: 2, item: 'BED' },
      ],
      publicChecks: [
        { period: 'AM', item: 'TRASH' },
        { period: 'PM', item: 'TOILET' },
        { period: 'PM', item: 'TABLE' },
      ],
    });
    const d = computeDaily(record);
    expect(d.bedDeduction).toBe(6);
    expect(d.publicDeduction).toBe(3);
    expect(d.disciplineDeduction).toBe(2);
    expect(d.totalDeduction).toBe(11);
    expect(d.score).toBe(9);
  });

  it('1.md §14：上午讲话2次下午1次 → 纪律扣 6', () => {
    const d = computeDaily(makeRecord({ talkAm: 2, talkPm: 1 }));
    expect(d.disciplineDeduction).toBe(6);
    expect(d.talkCount).toBe(3);
  });

  it('扣分超过 20 → 得分 0，原始扣分完整保留', () => {
    const bedChecks = Array.from({ length: 12 }, (_, i) => ({
      period: 'AM' as const,
      bedId: (i % 4) + 1,
      item: 'BED' as const,
    }));
    const publicChecks = Array.from({ length: 10 }, (_, i) => ({
      period: 'AM' as const,
      item: (['TRASH', 'BALCONY', 'INDOOR', 'TOILET', 'SINK', 'TABLE'] as const)[i % 6]!,
    }));
    const d = computeDaily(makeRecord({ bedChecks, publicChecks }));
    expect(d.totalDeduction).toBe(34);
    expect(d.score).toBe(0);
  });
});

describe('computePersonalShare 个人分摊', () => {
  it('1.md §10.1：1床两人正常，床面 -2 → 各 -1', () => {
    const record = makeRecord({ bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] });
    const share = computePersonalShare(record, CONFIG);
    expect(share.get(1)).toBe(1);
    expect(share.get(2)).toBe(1);
    expect(share.get(3)).toBeUndefined();
  });

  it('1.md §10.2：User1 请假 → User2 承担 2', () => {
    const record = makeRecord({
      bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }],
      userStatus: [
        { userId: 1, status: 'LEAVE' },
        ...CONFIG.users.slice(1).map((u) => ({ userId: u.id, status: 'NORMAL' as const })),
      ],
    });
    const share = computePersonalShare(record, CONFIG);
    expect(share.get(1)).toBeUndefined();
    expect(share.get(2)).toBe(2);
  });

  it('1.md §10.3：两人都请假 → 宿舍仍扣分但个人 0+0', () => {
    const record = makeRecord({
      bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }],
      userStatus: [
        { userId: 1, status: 'LEAVE' },
        { userId: 2, status: 'LEAVE' },
        ...CONFIG.users.slice(2).map((u) => ({ userId: u.id, status: 'NORMAL' as const })),
      ],
    });
    expect(computeDaily(record).bedDeduction).toBe(2);
    const share = computePersonalShare(record, CONFIG);
    expect(share.get(1)).toBeUndefined();
    expect(share.get(2)).toBeUndefined();
  });

  it('1.md §11：4床 User7 正常 → -2；请假 → 0', () => {
    const checks = [{ period: 'AM' as const, bedId: 4, item: 'BED' as const }];
    const normal = computePersonalShare(makeRecord({ bedChecks: checks }), CONFIG);
    expect(normal.get(7)).toBe(2);
    const leave = computePersonalShare(
      makeRecord({
        bedChecks: checks,
        userStatus: CONFIG.users.map((u) => ({
          userId: u.id,
          status: u.id === 7 ? ('LEAVE' as const) : ('NORMAL' as const),
        })),
      }),
      CONFIG,
    );
    expect(leave.get(7)).toBeUndefined();
  });

  it('1.md §13：公共区域 3 项全归值日生 User3 +3，其他人 0', () => {
    const record = makeRecord({
      publicChecks: [
        { period: 'AM', item: 'TRASH' },
        { period: 'AM', item: 'TOILET' },
        { period: 'PM', item: 'TABLE' },
      ],
    });
    const share = computePersonalShare(record, CONFIG);
    expect(share.get(3)).toBe(3);
    for (const u of CONFIG.users) if (u.id !== 3) expect(share.get(u.id)).toBeUndefined();
  });

  it('1.md §15：讲话永远不计入任何个人', () => {
    const share = computePersonalShare(makeRecord({ talkAm: 3 }), CONFIG);
    expect(share.size).toBe(0);
  });

  it('1.md §18 合并：个人分摊 U1=2 U2=2 U3=4 U4=1（纪律不计）', () => {
    const record = makeRecord({
      talkAm: 1,
      bedChecks: [
        { period: 'AM', bedId: 1, item: 'BED' },
        { period: 'PM', bedId: 1, item: 'BED' },
        { period: 'PM', bedId: 2, item: 'BED' },
      ],
      publicChecks: [
        { period: 'AM', item: 'TRASH' },
        { period: 'PM', item: 'TOILET' },
        { period: 'PM', item: 'TABLE' },
      ],
    });
    const share = computePersonalShare(record, CONFIG);
    expect(share.get(1)).toBe(2);
    expect(share.get(2)).toBe(2);
    expect(share.get(3)).toBe(4);
    expect(share.get(4)).toBe(1);
    expect([...share.values()].reduce((a, b) => a + b, 0)).toBe(9); // ≠ 宿舍总扣 11，正常（§22）
  });

  it('值日生请假的防御性兜底：公共区域不归任何人', () => {
    const record = makeRecord({
      publicChecks: [{ period: 'AM', item: 'TRASH' }],
      userStatus: CONFIG.users.map((u) => ({
        userId: u.id,
        status: u.id === 3 ? ('LEAVE' as const) : ('NORMAL' as const),
      })),
    });
    expect(computePersonalShare(record, CONFIG).get(3)).toBeUndefined();
  });
});

describe('computeFrequency 卫生频次', () => {
  it('上午+下午同一项目都勾选 → 计 2 次（1.md 确认 #9）', () => {
    const record = makeRecord({
      bedChecks: [
        { period: 'AM', bedId: 1, item: 'BED' },
        { period: 'PM', bedId: 1, item: 'BED' },
        { period: 'PM', bedId: 4, item: 'FLOOR' },
      ],
      publicChecks: [{ period: 'AM', item: 'TRASH' }],
    });
    const items = computeFrequency([record]);
    const byKey = new Map(items.map((i) => [i.key, i.count]));
    expect(items.map((i) => i.key)).toEqual([
      'BED',
      'FLOOR',
      'TRASH',
      'BALCONY',
      'INDOOR',
      'TOILET',
      'SINK',
      'TABLE',
    ]);
    expect(byKey.get('BED')).toBe(2);
    expect(byKey.get('FLOOR')).toBe(1);
    expect(byKey.get('TRASH')).toBe(1);
    expect(byKey.get('TOILET')).toBe(0);
  });
});

describe('周期统计', () => {
  const weekRecords = () => {
    // 2026-08-10(周一) ~ 2026-08-13(周四)，得分 16/18/20/17
    const mk = (date: string, bedCount: number, publicCount: number) =>
      makeRecord({
        date,
        bedChecks: Array.from({ length: bedCount }, (_, i) => ({
          period: 'AM' as const,
          bedId: (i % 4) + 1,
          item: 'BED' as const,
        })),
        publicChecks: Array.from({ length: publicCount }, (_, i) => ({
          period: 'AM' as const,
          item: 'TRASH' as const,
        })),
      });
    return [
      mk('2026-08-10', 2, 0), // 16
      mk('2026-08-11', 1, 0), // 18
      mk('2026-08-12', 0, 0), // 20
      mk('2026-08-13', 1, 1), // 17
    ];
  };

  it('1.md §24：周得分率 71 ÷ (20×4) = 88.75%', () => {
    const points = weeklyTrend(weekRecords());
    expect(points).toHaveLength(1);
    expect(points[0]!.key).toBe('2026-08-10');
    expect(points[0]!.label).toBe('08/10-08/16');
    expect(points[0]!.rate).toBe(88.75);
    expect(points[0]!.days).toBe(4);
  });

  it('撤回（REVOKED）记录不参与统计；恢复后重新参与', () => {
    const records = weekRecords();
    records[0]!.status = 'REVOKED';
    const revoked = weeklyTrend(records);
    expect(revoked[0]!.rate).toBe(rateOf([18, 20, 17]));
    records[0]!.status = 'ACTIVE';
    expect(weeklyTrend(records)[0]!.rate).toBe(88.75);
  });

  it('无有效日的周不产生数据点', () => {
    const points = weeklyTrend([makeRecord({ date: '2026-08-10', status: 'REVOKED' })]);
    expect(points).toEqual([]);
  });

  it('周跨月/跨周分组正确（周一起始）', () => {
    const records = [
      makeRecord({ date: '2026-08-10', talkAm: 0 }), // 周一
      makeRecord({ date: '2026-08-16', talkAm: 0 }), // 周日
      makeRecord({ date: '2026-08-17', talkAm: 0 }), // 下周一
    ];
    const points = weeklyTrend(records);
    expect(points.map((p) => p.key)).toEqual(['2026-08-10', '2026-08-17']);
  });

  it('月得分率与月趋势（只统计有效日）', () => {
    const records = [
      makeRecord({ date: '2026-08-03', bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] }), // 18
      makeRecord({ date: '2026-08-20' }), // 20
      makeRecord({ date: '2026-07-01' }), // 20，七月
      makeRecord({ date: '2026-08-21', status: 'REVOKED' }),
    ];
    const points = monthlyTrend(records);
    expect(points.map((p) => p.key)).toEqual(['2026-07', '2026-08']);
    expect(points[1]!.rate).toBe(95); // (18+20)/(20*2)
    expect(monthKeysWithRecords(records)).toEqual(['2026-07', '2026-08']);
  });

  it('日趋势：仅有效日，按日期升序', () => {
    const records = [
      makeRecord({ date: '2026-08-05', bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] }),
      makeRecord({ date: '2026-08-03' }),
      makeRecord({ date: '2026-08-04', status: 'REVOKED' }),
    ];
    expect(dailyTrend(records)).toEqual([
      {
        date: '2026-08-03',
        score: 20,
        totalDeduction: 0,
        bedDeduction: 0,
        publicDeduction: 0,
        disciplineDeduction: 0,
        talkCount: 0,
      },
      {
        date: '2026-08-05',
        score: 18,
        totalDeduction: 2,
        bedDeduction: 2,
        publicDeduction: 0,
        disciplineDeduction: 0,
        talkCount: 0,
      },
    ]);
  });
});

describe('disciplineRecords 纪律记录', () => {
  it('只显示违纪次数 > 0 的日期，按日期倒序（1.md §17）', () => {
    const records = [
      makeRecord({ date: '2026-08-01' }),
      makeRecord({ date: '2026-08-02', talkAm: 1, talkPm: 1 }),
      makeRecord({ date: '2026-08-03', talkPm: 3 }),
      makeRecord({ date: '2026-08-04', talkAm: 2, status: 'REVOKED' }),
    ];
    expect(disciplineRecords(records)).toEqual([
      { date: '2026-08-03', talkAm: 0, talkPm: 3, count: 3 },
      { date: '2026-08-02', talkAm: 1, talkPm: 1, count: 2 },
    ]);
  });
});

describe('computeOverview 概览', () => {
  it('今日有记录 → 返回今日得分；无记录 → null（前端显示 -）', () => {
    const today = '2026-08-16';
    const withToday = computeOverview(
      [makeRecord({ date: today, bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] })],
      today,
    );
    expect(withToday.today?.score).toBe(18);
    const without = computeOverview([makeRecord({ date: '2026-08-15' })], today);
    expect(without.today).toBeNull();
    const revoked = computeOverview([makeRecord({ date: today, status: 'REVOKED' })], today);
    expect(revoked.today).toBeNull();
  });

  it('本周/本月得分率只统计有效日；无有效日返回 null', () => {
    const today = '2026-08-16';
    const o = computeOverview(
      [
        makeRecord({ date: '2026-08-10' }), // 20
        makeRecord({ date: '2026-08-11', bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] }), // 18
      ],
      today,
    );
    expect(o.weekRate).toEqual({ label: '08/10-08/16', rate: 95, days: 2, fullScoreDays: 1 });
    expect(o.monthRate?.days).toBe(2);
    expect(o.monthRate?.fullScoreDays).toBe(1);
    const empty = computeOverview([], today);
    expect(empty.weekRate).toBeNull();
    expect(empty.monthRate).toBeNull();
  });
});

describe('computePersonalMonthly 个人月累计', () => {
  it('按月过滤，默认最新月份', () => {
    const records = [
      makeRecord({ date: '2026-08-01', bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] }),
      makeRecord({ date: '2026-07-01', bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] }),
    ];
    const months = monthKeysWithRecords(records);
    const latest = computePersonalMonthly(records, CONFIG, null, months);
    expect(latest.selectedMonth).toBe('2026-08');
    expect(latest.users.find((u) => u.userId === 1)?.deduction).toBe(1);
    const july = computePersonalMonthly(records, CONFIG, '2026-07', months);
    expect(july.users.find((u) => u.userId === 1)?.deduction).toBe(1);
  });

  it('无记录月份列表为空时，全员 0 分', () => {
    const r = computePersonalMonthly([], CONFIG, null, []);
    expect(r.selectedMonth).toBeNull();
    expect(r.users.every((u) => u.deduction === 0)).toBe(true);
  });

  it('扣分构成（床位/公共）与值日次数分开统计', () => {
    const records = [
      // 8/01：1床床面（U1/U2 各 1）+ 公共 2 项归值日生 U3
      makeRecord({
        date: '2026-08-01',
        dutyUserId: 3,
        bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }],
        publicChecks: [
          { period: 'AM', item: 'TRASH' },
          { period: 'AM', item: 'TOILET' },
        ],
      }),
      // 8/02：值日生 U5，无扣分
      makeRecord({ date: '2026-08-02', dutyUserId: 5 }),
    ];
    const months = monthKeysWithRecords(records);
    const r = computePersonalMonthly(records, CONFIG, '2026-08', months);
    const byId = new Map(r.users.map((u) => [u.userId, u]));
    expect(byId.get(1)!).toEqual({
      userId: 1,
      name: 'User1',
      deduction: 1,
      bedDeduction: 1,
      publicDeduction: 0,
      dutyCount: 0,
    });
    expect(byId.get(3)!.publicDeduction).toBe(2);
    expect(byId.get(3)!.deduction).toBe(2);
    expect(byId.get(3)!.dutyCount).toBe(1);
    expect(byId.get(5)!.deduction).toBe(0);
    expect(byId.get(5)!.dutyCount).toBe(1);
  });
});

describe('monthCalendar 月份历', () => {
  it('2026-08 共 31 天，首日 8/1 是星期六（weekday=6），无记录为 null', () => {
    const records = [
      makeRecord({ date: '2026-08-16', bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }] }),
    ];
    const days = monthCalendar(records, '2026-08');
    expect(days).toHaveLength(31);
    expect(days[0]!).toEqual({ date: '2026-08-01', weekday: 6, score: null });
    expect(days[15]!).toEqual({ date: '2026-08-16', weekday: 7, score: 18 });
    expect(days[30]!.date).toBe('2026-08-31');
  });

  it('REVOKED 记录视为无记录', () => {
    const days = monthCalendar([makeRecord({ date: '2026-08-05', status: 'REVOKED' })], '2026-08');
    expect(days[4]!.score).toBeNull();
  });

  it('跨年月份（2026-12 31 天 / 2026-02 28 天）', () => {
    expect(monthCalendar([], '2026-12')).toHaveLength(31);
    expect(monthCalendar([], '2026-02')).toHaveLength(28);
  });
});

describe('round2', () => {
  it('保留两位小数', () => {
    expect(round2(88.75)).toBe(88.75);
    expect(round2(88.755)).toBe(88.76);
    expect(round2(66.6666)).toBe(66.67);
  });
});
