// 展示层组装：记录 → API 响应形态；审计用的规范化快照
import { BED_ITEM_LABELS, PUBLIC_ITEM_LABELS } from './constants';
import { weekdayName } from './date';
import { computeDaily } from './calc/daily';
import type { AppConfig, InspectionRecord } from './types';

/** 审计日志用的稳定快照（排序后序列化，保证 before/after 可比较） */
export function normalizeRecord(r: InspectionRecord) {
  const byPeriod = (a: { period: string }, b: { period: string }) =>
    a.period.localeCompare(b.period);
  return {
    date: r.date,
    dutyUserId: r.dutyUserId,
    talkAm: r.talkAm,
    talkPm: r.talkPm,
    status: r.status,
    userStatus: [...r.userStatus]
      .sort((a, b) => a.userId - b.userId)
      .map((s) => ({ userId: s.userId, status: s.status })),
    bedChecks: [...r.bedChecks]
      .sort((a, b) => byPeriod(a, b) || a.bedId - b.bedId || a.item.localeCompare(b.item))
      .map((c) => ({ period: c.period, bedId: c.bedId, item: c.item })),
    publicChecks: [...r.publicChecks]
      .sort((a, b) => byPeriod(a, b) || a.item.localeCompare(b.item))
      .map((c) => ({ period: c.period, item: c.item })),
  };
}

/** 面向前端的完整记录形态（含姓名、标签与计算结果） */
export function enrichRecord(record: InspectionRecord, config: AppConfig) {
  const userById = new Map(config.users.map((u) => [u.id, u]));
  const bedById = new Map(config.beds.map((b) => [b.id, b]));
  const daily = computeDaily(record);
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
    bedChecks: record.bedChecks.map((c) => ({
      period: c.period,
      bedId: c.bedId,
      bedName: bedById.get(c.bedId)?.name ?? '',
      item: c.item,
      itemLabel: BED_ITEM_LABELS[c.item],
    })),
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
