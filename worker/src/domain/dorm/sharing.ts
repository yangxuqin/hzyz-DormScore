// 个人分摊：床位扣分池按命中床位的正常成员均摊 + 公共区域归值日生
import type { BedPool, AppConfig, InspectionRecord } from './model';
import { normalUserIds, occupantsOfBeds } from './rules';

export interface PoolShare {
  pool: BedPool;
  /** 责任人员 id（命中床位上的正常成员，已排除请假） */
  responsibleUserIds: number[];
  /** 每人分摊 = pool.deduction ÷ 责任人数；无人正常时为 0 */
  perUser: number;
}

/**
 * ★ 一个扣分池的责任分摊。
 *
 * 1. 取池内所有命中床位；
 * 2. 找出这些床位上的全部成员；
 * 3. 排除当天请假者；
 * 4. 剩余正常成员共同分担池扣分：每人 pool.deduction ÷ 人数。
 *
 * 全部命中床位成员都请假 → 宿舍仍扣该池分，但个人无人承担（合法结果）。
 */
export function computePoolShare(
  pool: BedPool,
  record: Pick<InspectionRecord, 'userStatus'>,
  config: AppConfig,
): PoolShare {
  const normal = normalUserIds(record);
  const responsibleUserIds = occupantsOfBeds(config, pool.beds).filter((id) => normal.has(id));
  const perUser = responsibleUserIds.length === 0 ? 0 : pool.deduction / responsibleUserIds.length;
  return { pool, responsibleUserIds, perUser };
}

/** 床位个人扣分：逐池分摊后按成员累加 */
export function computeBedShare(record: InspectionRecord, config: AppConfig): Map<number, number> {
  const result = new Map<number, number>();
  for (const pool of record.bedChecks) {
    const { responsibleUserIds, perUser } = computePoolShare(pool, record, config);
    if (responsibleUserIds.length === 0) continue;
    for (const id of responsibleUserIds) result.set(id, (result.get(id) ?? 0) + perUser);
  }
  return result;
}

/**
 * 公共区域：当天全部公共项目扣分归属当天值日生。
 * 兜底：值日生当天请假则不计任何个人（提交校验本应拦截该情况）。
 */
export function computePublicShare(record: InspectionRecord): Map<number, number> {
  const result = new Map<number, number>();
  if (record.publicChecks.length === 0) return result;
  const normal = normalUserIds(record);
  if (normal.has(record.dutyUserId)) {
    // 公共区域按 时段 × 项目 计，每项 PUBLIC_ITEM_POINTS 分
    result.set(record.dutyUserId, record.publicChecks.length);
  }
  return result;
}

/** 个人扣分 = 床位池分摊 + 值日生公共区域归属（纪律永远不计个人） */
export function computePersonalShare(
  record: InspectionRecord,
  config: AppConfig,
): Map<number, number> {
  const total = computeBedShare(record, config);
  for (const [id, pts] of computePublicShare(record)) {
    total.set(id, (total.get(id) ?? 0) + pts);
  }
  return total;
}

export interface PersonalMonthlyItem {
  userId: number;
  name: string;
  /** 合计个人扣分（允许小数） */
  deduction: number;
  /** 床位扣分池分摊 */
  bedDeduction: number;
  /** 值日生公共区域扣分 */
  publicDeduction: number;
  /** 本月值日天数 */
  dutyCount: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

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
      for (const [id, pts] of computeBedShare(r, config)) {
        bedTotal.set(id, (bedTotal.get(id) ?? 0) + pts);
      }
      for (const [id, pts] of computePublicShare(r)) {
        publicTotal.set(id, (publicTotal.get(id) ?? 0) + pts);
      }
    }
  }
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
