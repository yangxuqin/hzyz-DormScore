// 展示统计用例：月份日历 + 单日完整明细
import type { CalendarStats, EnrichedRecord } from '@dorm/contracts';
import {
  monthCalendar,
  monthKeysWithRecords,
  findActiveByDate,
} from '../../domain/dorm/statistics';
import { todayInShanghai } from '../../shared/date';
import type { Repositories } from '../../infrastructure/repositories';
import { enrichRecord } from '../../interfaces/http/presenter';

/** 月份历：默认当前月；months 为有记录月份与当前月的并集 */
export async function getCalendar(
  repos: Repositories,
  month: string | null,
): Promise<CalendarStats> {
  const records = await repos.inspections.list();
  const current = todayInShanghai().slice(0, 7);
  const months = [...new Set([...monthKeysWithRecords(records), current])].sort();
  const selected = month ?? current;
  return { selectedMonth: selected, months, days: monthCalendar(records, selected) };
}

/** 单日明细：无有效记录（含 REVOKED）返回 null */
export async function getDayDetail(
  repos: Repositories,
  date: string,
): Promise<EnrichedRecord | null> {
  const records = await repos.inspections.list();
  const record = findActiveByDate(records, date);
  if (!record) return null;
  return enrichRecord(record, await repos.config.getConfig());
}
