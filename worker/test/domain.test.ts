// 领域层单元测试（扣分池模型）：单日计算 / 个人分摊 / 统计 / 频次 / 纪律
import { describe, expect, it } from 'vitest';
import { computeDaily } from '../src/domain/dorm/scoring';
import {
  computeBedShare,
  computePersonalMonthly,
  computePersonalShare,
  computePoolShare,
  round2,
} from '../src/domain/dorm/sharing';
import {
  computeFrequency,
  computeOverview,
  dailyTrend,
  disciplineRecords,
  monthCalendar,
  monthKeysWithRecords,
  monthlyTrend,
  rateOf,
  weeklyTrend,
} from '../src/domain/dorm/statistics';
import { CONFIG, allNormal, makeRecord, pool } from './fixtures';

describe('★ 扣分池模型：多床位只扣一个池分', () => {
  it('AM FLOOR 命中 1、3 床 → 宿舍只扣 2 分（不是 4 分）', () => {
    const record = makeRecord({ bedChecks: [pool('AM', 'FLOOR', [1, 3])] });
    expect(computeDaily(record).bedDeduction).toBe(2);
  });

  it('AM FLOOR 命中全部 4 张床 → 仍只扣 2 分', () => {
    const record = makeRecord({ bedChecks: [pool('AM', 'FLOOR', [1, 2, 3, 4])] });
    expect(computeDaily(record).bedDeduction).toBe(2);
  });

  it('四个池 AM/PM × BED/FLOOR 全命中 → 全天床位最多 8 分', () => {
    const record = makeRecord({
      bedChecks: [
        pool('AM', 'BED', [1, 2, 3, 4]),
        pool('AM', 'FLOOR', [1, 2, 3, 4]),
        pool('PM', 'BED', [1, 2, 3, 4]),
        pool('PM', 'FLOOR', [1, 2, 3, 4]),
      ],
    });
    expect(computeDaily(record).bedDeduction).toBe(8);
  });

  it('上午与下午独立：同区域上下午各命中 → 4 分', () => {
    const record = makeRecord({
      bedChecks: [pool('AM', 'BED', [1]), pool('PM', 'BED', [1])],
    });
    expect(computeDaily(record).bedDeduction).toBe(4);
  });

  it('床面与床下独立：同时段两个区域各 2 分', () => {
    const record = makeRecord({
      bedChecks: [pool('AM', 'BED', [1]), pool('AM', 'FLOOR', [2])],
    });
    expect(computeDaily(record).bedDeduction).toBe(4);
  });
});

describe('computeDaily 单日宿舍扣分与得分', () => {
  it('空记录：0 扣分，20 分', () => {
    expect(computeDaily(makeRecord())).toEqual({
      bedDeduction: 0,
      publicDeduction: 0,
      disciplineDeduction: 0,
      talkCount: 0,
      totalDeduction: 0,
      score: 20,
    });
  });

  it('床位池 4 + 公共 3 + 纪律 2 → 总扣 9，得分 11', () => {
    const record = makeRecord({
      talkAm: 1,
      bedChecks: [pool('AM', 'BED', [1]), pool('PM', 'BED', [1, 2])],
      publicChecks: [
        { period: 'AM', item: 'TRASH' },
        { period: 'PM', item: 'TOILET' },
        { period: 'PM', item: 'TABLE' },
      ],
    });
    const d = computeDaily(record);
    expect(d.bedDeduction).toBe(4);
    expect(d.publicDeduction).toBe(3);
    expect(d.disciplineDeduction).toBe(2);
    expect(d.totalDeduction).toBe(9);
    expect(d.score).toBe(11);
  });

  it('讲话 2 次 + 下午 1 次 → 纪律扣 6', () => {
    const d = computeDaily(makeRecord({ talkAm: 2, talkPm: 1 }));
    expect(d.disciplineDeduction).toBe(6);
    expect(d.talkCount).toBe(3);
  });

  it('扣分超过 20 → 得分 0，原始扣分完整保留（不被截断）', () => {
    const record = makeRecord({
      talkAm: 1,
      bedChecks: [
        pool('AM', 'BED', [1, 2, 3, 4]),
        pool('AM', 'FLOOR', [1, 2, 3, 4]),
        pool('PM', 'BED', [1, 2, 3, 4]),
        pool('PM', 'FLOOR', [1, 2, 3, 4]),
      ],
      publicChecks: [
        ...(['TRASH', 'BALCONY', 'INDOOR', 'TOILET', 'SINK', 'TABLE'] as const).map((item) => ({
          period: 'AM' as const,
          item,
        })),
        ...(['TRASH', 'BALCONY', 'INDOOR', 'TOILET', 'SINK', 'TABLE'] as const).map((item) => ({
          period: 'PM' as const,
          item,
        })),
      ],
    });
    const d = computeDaily(record);
    expect(d.totalDeduction).toBe(22); // 8 床位 + 12 公共 + 2 纪律
    expect(d.score).toBe(0);
  });

  it('历史扣分快照：池 deduction 变化时按快照计算', () => {
    const record = makeRecord({
      bedChecks: [{ period: 'AM', item: 'BED', beds: [1], deduction: 5 }],
    });
    expect(computeDaily(record).bedDeduction).toBe(5);
  });
});

describe('computePoolShare 扣分池责任分摊', () => {
  it('AM FLOOR beds=[1,3] → 池扣 2，User1/2/5/6 各 0.5', () => {
    const record = makeRecord({ bedChecks: [pool('AM', 'FLOOR', [1, 3])] });
    const share = computePoolShare(record.bedChecks[0]!, record, CONFIG);
    expect(share.pool.deduction).toBe(2);
    expect(share.responsibleUserIds).toEqual([1, 2, 5, 6]);
    expect(share.perUser).toBe(0.5);
    const personal = computePersonalShare(record, CONFIG);
    expect(personal.get(1)).toBe(0.5);
    expect(personal.get(2)).toBe(0.5);
    expect(personal.get(5)).toBe(0.5);
    expect(personal.get(6)).toBe(0.5);
    expect(personal.get(3)).toBeUndefined();
  });

  it('命中床位有人请假 → 由剩余正常人员承担（2 ÷ 3）', () => {
    const record = makeRecord({
      bedChecks: [pool('AM', 'FLOOR', [1, 3])],
      userStatus: allNormal().map((s) => (s.userId === 2 ? { ...s, status: 'LEAVE' } : s)),
    });
    const share = computePoolShare(record.bedChecks[0]!, record, CONFIG);
    expect(share.responsibleUserIds).toEqual([1, 5, 6]);
    expect(round2(share.perUser)).toBe(0.67);
    const personal = computePersonalShare(record, CONFIG);
    expect(personal.get(2)).toBeUndefined();
    expect(round2(personal.get(1)!)).toBe(0.67);
  });

  it('命中床位全体请假 → 宿舍仍扣 2，个人无人承担', () => {
    const record = makeRecord({
      bedChecks: [pool('AM', 'FLOOR', [1, 3])],
      userStatus: allNormal().map((s) =>
        [1, 2, 5, 6].includes(s.userId) ? { ...s, status: 'LEAVE' as const } : s,
      ),
    });
    expect(computeDaily(record).bedDeduction).toBe(2);
    const personal = computePersonalShare(record, CONFIG);
    for (const id of [1, 2, 5, 6]) expect(personal.get(id)).toBeUndefined();
  });

  it('单床命中：1床两人正常 → 各 1；4床单人正常 → 2', () => {
    const share = computeBedShare(
      makeRecord({ bedChecks: [pool('AM', 'BED', [1]), pool('PM', 'BED', [4])] }),
      CONFIG,
    );
    expect(share.get(1)).toBe(1);
    expect(share.get(2)).toBe(1);
    expect(share.get(7)).toBe(2);
  });

  it('一人请假：1床一人请假 → 在场者承担 2', () => {
    const share = computeBedShare(
      makeRecord({
        bedChecks: [pool('AM', 'BED', [1])],
        userStatus: allNormal().map((s) => (s.userId === 1 ? { ...s, status: 'LEAVE' } : s)),
      }),
      CONFIG,
    );
    expect(share.get(1)).toBeUndefined();
    expect(share.get(2)).toBe(2);
  });
});

describe('computePersonalShare 公共区域与纪律', () => {
  it('公共区域 3 项全部归当天值日生 User3 +3', () => {
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

  it('讲话永远不计入任何个人扣分', () => {
    expect(computePersonalShare(makeRecord({ talkAm: 3 }), CONFIG).size).toBe(0);
  });

  it('值日生请假的防御性兜底：公共区域不归任何人', () => {
    const record = makeRecord({
      publicChecks: [{ period: 'AM', item: 'TRASH' }],
      userStatus: allNormal().map((s) => (s.userId === 3 ? { ...s, status: 'LEAVE' } : s)),
    });
    expect(computePersonalShare(record, CONFIG).get(3)).toBeUndefined();
  });

  it('个人分摊总和可以不等于宿舍总扣分（全部责任人请假）', () => {
    const record = makeRecord({
      bedChecks: [pool('AM', 'FLOOR', [1])],
      userStatus: allNormal().map((s) =>
        s.userId === 1 || s.userId === 2 ? { ...s, status: 'LEAVE' as const } : s,
      ),
    });
    expect(computeDaily(record).bedDeduction).toBe(2);
    expect([...computePersonalShare(record, CONFIG).values()]).toEqual([]);
  });
});

describe('computeFrequency 卫生频次', () => {
  it('一个池计一次；上午+下午同项目各算一次', () => {
    const record = makeRecord({
      bedChecks: [pool('AM', 'BED', [1, 2, 3]), pool('PM', 'BED', [4])],
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
    expect(byKey.get('TRASH')).toBe(1);
    expect(byKey.get('TOILET')).toBe(0);
  });
});

describe('周期统计', () => {
  const weekRecords = () => [
    makeRecord({ date: '2026-08-10', bedChecks: [pool('AM', 'BED', [1]), pool('PM', 'BED', [1])] }), // 16
    makeRecord({ date: '2026-08-11', bedChecks: [pool('AM', 'BED', [1])] }), // 18
    makeRecord({ date: '2026-08-12' }), // 20
    makeRecord({
      date: '2026-08-13',
      bedChecks: [pool('AM', 'BED', [1])],
      publicChecks: [{ period: 'AM', item: 'TRASH' }],
    }), // 17
  ];

  it('周得分率 71 ÷ (20×4) = 88.75%', () => {
    const points = weeklyTrend(weekRecords());
    expect(points).toHaveLength(1);
    expect(points[0]!.key).toBe('2026-08-10');
    expect(points[0]!.label).toBe('08/10-08/16');
    expect(points[0]!.rate).toBe(88.75);
    expect(points[0]!.days).toBe(4);
  });

  it('撤回记录不参与统计；恢复后重新参与', () => {
    const records = weekRecords();
    records[0]!.status = 'REVOKED';
    expect(weeklyTrend(records)[0]!.rate).toBe(rateOf([18, 20, 17]));
    records[0]!.status = 'ACTIVE';
    expect(weeklyTrend(records)[0]!.rate).toBe(88.75);
  });

  it('无有效日的周不产生数据点', () => {
    expect(weeklyTrend([makeRecord({ date: '2026-08-10', status: 'REVOKED' })])).toEqual([]);
  });

  it('周分组以周一为起点（跨周正确）', () => {
    const points = weeklyTrend([
      makeRecord({ date: '2026-08-10' }),
      makeRecord({ date: '2026-08-16' }),
      makeRecord({ date: '2026-08-17' }),
    ]);
    expect(points.map((p) => p.key)).toEqual(['2026-08-10', '2026-08-17']);
  });

  it('月得分率与月趋势只统计有效日', () => {
    const records = [
      makeRecord({ date: '2026-08-03', bedChecks: [pool('AM', 'BED', [1])] }), // 18
      makeRecord({ date: '2026-08-20' }), // 20
      makeRecord({ date: '2026-07-01' }), // 20
      makeRecord({ date: '2026-08-21', status: 'REVOKED' }),
    ];
    const points = monthlyTrend(records);
    expect(points.map((p) => p.key)).toEqual(['2026-07', '2026-08']);
    expect(points[1]!.rate).toBe(95);
    expect(monthKeysWithRecords(records)).toEqual(['2026-07', '2026-08']);
  });

  it('日趋势：仅有效日、按日期升序、含扣分构成', () => {
    const records = [
      makeRecord({ date: '2026-08-05', bedChecks: [pool('AM', 'BED', [1])] }),
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
  it('只显示违纪次数 > 0 的日期，按日期倒序', () => {
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
  it('今日有记录 → 返回今日结果；无记录 / 已撤回 → null', () => {
    const today = '2026-08-16';
    const withToday = computeOverview(
      [makeRecord({ date: today, bedChecks: [pool('AM', 'BED', [1])] })],
      today,
    );
    expect(withToday.today?.score).toBe(18);
    expect(computeOverview([makeRecord({ date: '2026-08-15' })], today).today).toBeNull();
    expect(
      computeOverview([makeRecord({ date: today, status: 'REVOKED' })], today).today,
    ).toBeNull();
  });

  it('本周/本月得分率只统计有效日；无有效日返回 null', () => {
    const today = '2026-08-16';
    const o = computeOverview(
      [
        makeRecord({ date: '2026-08-10' }), // 20
        makeRecord({ date: '2026-08-11', bedChecks: [pool('AM', 'BED', [1])] }), // 18
      ],
      today,
    );
    expect(o.weekRate).toEqual({ label: '08/10-08/16', rate: 95, days: 2, fullScoreDays: 1 });
    expect(o.monthRate?.days).toBe(2);
    const empty = computeOverview([], today);
    expect(empty.weekRate).toBeNull();
    expect(empty.monthRate).toBeNull();
  });
});

describe('computePersonalMonthly 个人月累计', () => {
  it('按月过滤，默认最新月份；个人可用小数', () => {
    const records = [
      makeRecord({ date: '2026-08-01', bedChecks: [pool('AM', 'BED', [1])] }),
      makeRecord({ date: '2026-07-01', bedChecks: [pool('AM', 'BED', [1])] }),
    ];
    const months = monthKeysWithRecords(records);
    const latest = computePersonalMonthly(records, CONFIG, null, months);
    expect(latest.selectedMonth).toBe('2026-08');
    expect(latest.users.find((u) => u.userId === 1)?.deduction).toBe(1);
  });

  it('无记录月份列表为空时全员 0 分', () => {
    const r = computePersonalMonthly([], CONFIG, null, []);
    expect(r.selectedMonth).toBeNull();
    expect(r.users.every((u) => u.deduction === 0)).toBe(true);
  });

  it('扣分构成（床位/公共）与值日次数分开统计', () => {
    const records = [
      makeRecord({
        date: '2026-08-01',
        dutyUserId: 3,
        bedChecks: [pool('AM', 'BED', [1])],
        publicChecks: [
          { period: 'AM', item: 'TRASH' },
          { period: 'AM', item: 'TOILET' },
        ],
      }),
      makeRecord({ date: '2026-08-02', dutyUserId: 5 }),
    ];
    const months = monthKeysWithRecords(records);
    const r = computePersonalMonthly(records, CONFIG, '2026-08', months);
    const byId = new Map(r.users.map((u) => [u.userId, u]));
    expect(byId.get(1)).toEqual({
      userId: 1,
      name: 'User1',
      deduction: 1,
      bedDeduction: 1,
      publicDeduction: 0,
      dutyCount: 0,
    });
    expect(byId.get(3)!.publicDeduction).toBe(2);
    expect(byId.get(3)!.dutyCount).toBe(1);
    expect(byId.get(5)!.deduction).toBe(0);
    expect(byId.get(5)!.dutyCount).toBe(1);
  });
});

describe('monthCalendar 月份历', () => {
  it('2026-08 共 31 天，无记录为 null', () => {
    const records = [makeRecord({ date: '2026-08-16', bedChecks: [pool('AM', 'BED', [1])] })];
    const days = monthCalendar(records, '2026-08');
    expect(days).toHaveLength(31);
    expect(days[0]!).toEqual({ date: '2026-08-01', weekday: 6, score: null });
    expect(days[15]!).toEqual({ date: '2026-08-16', weekday: 7, score: 18 });
  });

  it('REVOKED 记录视为无记录', () => {
    const days = monthCalendar([makeRecord({ date: '2026-08-05', status: 'REVOKED' })], '2026-08');
    expect(days[4]!.score).toBeNull();
  });

  it('跨年月份天数正确', () => {
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
