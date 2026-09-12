// 前端扣分池本地计算：仅用于录入页实时预览，最终以后端返回为准。
import type { AppConfig, BedItem, Period, PublicItem, UserStatus } from '@dorm/contracts';
import { BASE_SCORE, BED_POOL_POINTS, PUBLIC_ITEM_POINTS, TALK_POINTS } from './constants';

export interface LocalPool {
  period: Period;
  item: BedItem;
  beds: number[];
}

export interface LocalPublicCheck {
  period: Period;
  item: PublicItem;
}

export interface ResponsiblePreview {
  pool: LocalPool;
  /** 命中床位上的正常成员 */
  users: { userId: number; name: string }[];
  /** 人均分摊 = 池扣分 ÷ 正常责任人数；无人时为 0 */
  perUser: number;
}

export interface LocalSummary {
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
  totalDeduction: number;
  score: number;
  /** 责任分摊预览（仅含命中有人的池） */
  responsible: ResponsiblePreview[];
}

function normalSet(userStatus: Map<number, UserStatus>): Set<number> {
  const set = new Set<number>();
  for (const [userId, status] of userStatus) if (status === 'NORMAL') set.add(userId);
  return set;
}

/** 某池的责任人预览 */
export function previewPool(
  pool: LocalPool,
  config: AppConfig,
  userStatus: Map<number, UserStatus>,
): ResponsiblePreview {
  const normal = normalSet(userStatus);
  const beds = new Set(pool.beds);
  const users = config.users
    .filter((u) => beds.has(u.bedId) && normal.has(u.id))
    .map((u) => ({ userId: u.id, name: u.name }));
  return {
    pool,
    users,
    perUser: users.length === 0 ? 0 : BED_POOL_POINTS / users.length,
  };
}

/**
 * 本地实时统计：床位按池计数（一个池 2 分），公共按项，纪律按讲话次数。
 * 这与后端 computeDaily 完全一致，用于录入时即时反馈。
 */
export function computeLocalSummary(
  pools: LocalPool[],
  publicChecks: LocalPublicCheck[],
  talkCount: number,
  config: AppConfig,
  userStatus: Map<number, UserStatus>,
): LocalSummary {
  const bedDeduction = pools.length * BED_POOL_POINTS;
  const publicDeduction = publicChecks.length * PUBLIC_ITEM_POINTS;
  const disciplineDeduction = talkCount * TALK_POINTS;
  const totalDeduction = bedDeduction + publicDeduction + disciplineDeduction;
  return {
    bedDeduction,
    publicDeduction,
    disciplineDeduction,
    talkCount,
    totalDeduction,
    score: Math.max(0, BASE_SCORE - totalDeduction),
    responsible: pools.map((p) => previewPool(p, config, userStatus)),
  };
}

/** 得分 → 档位（表现层用，不改变业务计算） */
export type ScoreTier = 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'none';

export function scoreTier(score: number | null): ScoreTier {
  if (score === null) return 'none';
  if (score >= 20) return 'excellent';
  if (score >= 15) return 'good';
  if (score >= 10) return 'fair';
  if (score >= 5) return 'poor';
  return 'critical';
}

export const SCORE_TIER_LABEL: Record<ScoreTier, string> = {
  excellent: '优秀',
  good: '良好',
  fair: '一般',
  poor: '较差',
  critical: '严重',
  none: '无记录',
};

export function formatShare(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

export function formatRate(rate: number): string {
  return String(parseFloat(rate.toFixed(2)));
}
