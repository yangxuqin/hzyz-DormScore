// 展示统计用例：个人月累计扣分（含构成与值日次数）
import type { PersonalStats } from '@dorm/contracts';
import { computePersonalMonthly } from '../../domain/dorm/sharing';
import { monthKeysWithRecords } from '../../domain/dorm/statistics';
import type { Repositories } from '../../infrastructure/repositories';

export async function getPersonalStats(
  repos: Repositories,
  month: string | null,
): Promise<PersonalStats> {
  const records = await repos.inspections.list();
  const config = await repos.config.getConfig();
  const months = monthKeysWithRecords(records);
  return computePersonalMonthly(records, config, month, months);
}
