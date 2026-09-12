// 展示统计用例：概览（今日 + 周/月得分率 + 今日完整明细）
import type { OverviewData } from '@dorm/contracts';
import { computeOverview, findActiveByDate } from '../../domain/dorm/statistics';
import { todayInShanghai } from '../../shared/date';
import type { Repositories } from '../../infrastructure/repositories';
import { enrichRecord } from '../../interfaces/http/presenter';

export async function getOverview(repos: Repositories): Promise<OverviewData> {
  const records = await repos.inspections.list();
  const today = todayInShanghai();
  const overview = computeOverview(records, today);
  let todayRecord: OverviewData['today'] = null;
  const active = findActiveByDate(records, today);
  if (active) todayRecord = enrichRecord(active, await repos.config.getConfig());
  return { today: todayRecord, weekRate: overview.weekRate, monthRate: overview.monthRate };
}
