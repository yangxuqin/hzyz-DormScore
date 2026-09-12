// 展示层组装：领域记录 → API 响应形态（含扣分池责任分摊）；审计用规范化快照
import type { BedPoolView, EnrichedRecord } from '@dorm/contracts';
import { BED_ITEM_LABELS, PUBLIC_ITEM_LABELS } from '../../domain/dorm/constants';
import { computeDaily } from '../../domain/dorm/scoring';
import { computePoolShare, round2 } from '../../domain/dorm/sharing';
import { weekdayName } from '../../shared/date';
import type { AppConfig, InspectionRecord } from '../../domain/dorm/model';

/** 审计日志用的稳定快照（排序后序列化，保证 before/after 可比较） */
export function normalizeRecord(record: InspectionRecord) {
  return {
    date: record.date,
    dutyUserId: record.dutyUserId,
    talkAm: record.talkAm,
    talkPm: record.talkPm,
    status: record.status,
    userStatus: [...record.userStatus]
      .sort((a, b) => a.userId - b.userId)
      .map((s) => ({ userId: s.userId, status: s.status })),
    bedChecks: [...record.bedChecks]
      .sort((a, b) => a.period.localeCompare(b.period) || a.item.localeCompare(b.item))
      .map((p) => ({
        period: p.period,
        item: p.item,
        beds: [...p.beds].sort((x, y) => x - y),
        deduction: p.deduction,
      })),
    publicChecks: [...record.publicChecks]
      .sort((a, b) => a.period.localeCompare(b.period) || a.item.localeCompare(b.item))
      .map((c) => ({ period: c.period, item: c.item })),
  };
}

/** 面向前端的完整记录形态（含姓名、标签、扣分池责任分摊与计算结果） */
export function enrichRecord(record: InspectionRecord, config: AppConfig): EnrichedRecord {
  const userById = new Map(config.users.map((u) => [u.id, u]));
  const bedById = new Map(config.beds.map((b) => [b.id, b]));
  const daily = computeDaily(record);

  const bedChecks: BedPoolView[] = record.bedChecks.map((pool) => {
    const share = computePoolShare(pool, record, config);
    return {
      period: pool.period,
      item: pool.item,
      itemLabel: BED_ITEM_LABELS[pool.item],
      beds: pool.beds,
      bedNames: pool.beds.map((id) => bedById.get(id)?.name ?? `${id}床`),
      deduction: pool.deduction,
      responsibleUsers: share.responsibleUserIds.map((userId) => ({
        userId,
        name: userById.get(userId)?.name ?? '',
        share: round2(share.perUser),
      })),
    };
  });

  return {
    id: record.id,
    date: record.date,
    weekday: weekdayName(record.date),
    dutyUserId: record.dutyUserId,
    dutyUserName: userById.get(record.dutyUserId)?.name ?? '',
    status: record.status,
    talkAm: record.talkAm,
    talkPm: record.talkPm,
    userStatus: record.userStatus.map((s) => ({
      userId: s.userId,
      userName: userById.get(s.userId)?.name ?? '',
      status: s.status,
    })),
    bedChecks,
    publicChecks: record.publicChecks.map((c) => ({
      period: c.period,
      item: c.item,
      itemLabel: PUBLIC_ITEM_LABELS[c.item],
    })),
    bedDeduction: daily.bedDeduction,
    publicDeduction: daily.publicDeduction,
    disciplineDeduction: daily.disciplineDeduction,
    talkCount: daily.talkCount,
    totalDeduction: daily.totalDeduction,
    score: daily.score,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
