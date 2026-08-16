// 卫生扣分频次：统计发生次数（不是扣分金额）；上午+下午同一项目各算一次（1.md §29）
import { HYGIENE_FREQUENCY_ITEMS } from '../constants';
import type { InspectionRecord } from '../types';

export interface FrequencyItem {
  key: string;
  label: string;
  count: number;
}

export function computeFrequency(records: InspectionRecord[]): FrequencyItem[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const c of r.bedChecks) counts.set(c.item, (counts.get(c.item) ?? 0) + 1);
    for (const c of r.publicChecks) counts.set(c.item, (counts.get(c.item) ?? 0) + 1);
  }
  return HYGIENE_FREQUENCY_ITEMS.map(({ key, label }) => ({
    key,
    label,
    count: counts.get(key) ?? 0,
  }));
}
