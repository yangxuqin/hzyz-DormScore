// 领域规则工具：扣分池标识、床位规范化、请假判定
import type { BedItem, Period, UserStatus } from '@dorm/contracts';
import type { AppConfig, BedPool, InspectionRecord } from './model';

/** 扣分池唯一键：时段:区域 */
export function poolKey(period: Period, item: BedItem): string {
  return `${period}:${item}`;
}

/** 床位 id 去重并升序；命中床位数只影响责任分摊，不影响扣分 */
export function normalizeBeds(beds: number[]): number[] {
  return [...new Set(beds)].sort((a, b) => a - b);
}

/** 当天正常（未请假）的成员 id 集合 */
export function normalUserIds(record: Pick<InspectionRecord, 'userStatus'>): Set<number> {
  return new Set(record.userStatus.filter((s) => s.status === 'NORMAL').map((s) => s.userId));
}

export function statusOf(record: Pick<InspectionRecord, 'userStatus'>, userId: number): UserStatus {
  return record.userStatus.find((s) => s.userId === userId)?.status ?? 'NORMAL';
}

/** 扣分池命中的床位所属成员 id（可含请假人员，再由调用方排除） */
export function occupantsOfBeds(config: AppConfig, beds: number[]): number[] {
  const hit = new Set(beds);
  return config.users.filter((u) => hit.has(u.bedId)).map((u) => u.id);
}

/** 所有池的扣分合计（使用各池快照值） */
export function sumPoolDeduction(pools: BedPool[]): number {
  return pools.reduce((sum, p) => sum + p.deduction, 0);
}
