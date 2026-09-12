// 展示统计用例：卫生扣分频次
import type { FrequencyStats } from '@dorm/contracts';
import { computeFrequency, monthKeysWithRecords } from '../../domain/dorm/statistics';
import type { Repositories } from '../../infrastructure/repositories';

export async function getFrequencyStats(
  repos: Repositories,
  month: string | null,
): Promise<FrequencyStats> {
  const records = await repos.inspections.list();
  const months = monthKeysWithRecords(records);
  const selected = month ?? months[months.length - 1] ?? null;
  const items = selected
    ? computeFrequency(
        records.filter((r) => r.status === 'ACTIVE' && r.date.slice(0, 7) === selected),
      )
    : computeFrequency([]);
  return { selectedMonth: selected, months, items };
}
