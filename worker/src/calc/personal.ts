// 个人扣分：床位分摊 + 值日生公共区域归属（1.md §9-§15、§21）
import { BED_ITEM_POINTS } from '../constants';
import type { AppConfig, InspectionRecord } from '../types';

/**
 * 床位个人区域分摊：每个被勾选项目扣 2 分，均摊给该床当天“正常”的成员。
 * - 上下铺 2 人正常 → 各 1；1 人请假 → 在场者 2；2 人请假 → 0+0（宿舍仍 -2）
 * - 单人床正常 → 2；请假 → 0
 */
export function computeBedShare(record: InspectionRecord, config: AppConfig): Map<number, number> {
  const result = new Map<number, number>();
  const normal = new Set(
    record.userStatus.filter((s) => s.status === 'NORMAL').map((s) => s.userId),
  );
  for (const check of record.bedChecks) {
    const present = config.users.filter((u) => u.bedId === check.bedId && normal.has(u.id));
    if (present.length === 0) continue;
    const each = BED_ITEM_POINTS / present.length;
    for (const u of present) result.set(u.id, (result.get(u.id) ?? 0) + each);
  }
  return result;
}

/**
 * 公共区域：全部归当天值日生。
 * 兜底：值日生请假时不计任何个人（提交校验本应拦截该情况）。
 */
export function computePublicShare(record: InspectionRecord): Map<number, number> {
  const result = new Map<number, number>();
  if (record.publicChecks.length === 0) return result;
  const normal = new Set(
    record.userStatus.filter((s) => s.status === 'NORMAL').map((s) => s.userId),
  );
  if (normal.has(record.dutyUserId)) result.set(record.dutyUserId, record.publicChecks.length);
  return result;
}

/** 个人扣分 = 床位分摊 + 值日生公共区域归属（纪律永远不计个人） */
export function computePersonalShare(
  record: InspectionRecord,
  config: AppConfig,
): Map<number, number> {
  const bed = computeBedShare(record, config);
  for (const [id, pts] of computePublicShare(record)) bed.set(id, (bed.get(id) ?? 0) + pts);
  return bed;
}

export interface PersonalMonthlyItem {
  userId: number;
  name: string;
  /** 合计个人扣分 */
  deduction: number;
  /** 床位个人区域分摊 */
  bedDeduction: number;
  /** 值日生公共区域扣分 */
  publicDeduction: number;
  /** 本月值日天数 */
  dutyCount: number;
}

/** 某月 7 人累计个人扣分（含构成与值日次数）；month 缺省时取最新有数据的月份 */
export function computePersonalMonthly(
  records: InspectionRecord[],
  config: AppConfig,
  month: string | null,
  months: string[],
): { selectedMonth: string | null; months: string[]; users: PersonalMonthlyItem[] } {
  const selected = month && months.includes(month) ? month : (months[months.length - 1] ?? null);
  const bedTotal = new Map<number, number>();
  const publicTotal = new Map<number, number>();
  const dutyCount = new Map<number, number>();
  if (selected) {
    for (const r of records) {
      if (r.status !== 'ACTIVE' || r.date.slice(0, 7) !== selected) continue;
      dutyCount.set(r.dutyUserId, (dutyCount.get(r.dutyUserId) ?? 0) + 1);
      for (const [id, pts] of computeBedShare(r, config))
        bedTotal.set(id, (bedTotal.get(id) ?? 0) + pts);
      for (const [id, pts] of computePublicShare(r))
        publicTotal.set(id, (publicTotal.get(id) ?? 0) + pts);
    }
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    selectedMonth: selected,
    months,
    users: config.users.map((u) => {
      const bed = round2(bedTotal.get(u.id) ?? 0);
      const pub = round2(publicTotal.get(u.id) ?? 0);
      return {
        userId: u.id,
        name: u.name,
        bedDeduction: bed,
        publicDeduction: pub,
        deduction: round2(bed + pub),
        dutyCount: dutyCount.get(u.id) ?? 0,
      };
    }),
  };
}
