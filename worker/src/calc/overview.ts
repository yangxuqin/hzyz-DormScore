// 成绩概览：今日得分（无记录为 null，前端显示 -）、本周/本月得分率（1.md §27 模块一）
import { mondayOf, monthKeyOf, sundayOf, todayInShanghai, weekLabel } from '../date';
import type { InspectionRecord } from '../types';
import { computeDaily, type DailyResult } from './daily';
import { rateOf } from './trends';

export interface Overview {
  today: ({ date: string } & DailyResult) | null;
  weekRate: { label: string; rate: number; days: number } | null;
  monthRate: { label: string; rate: number; days: number } | null;
}

export function computeOverview(
  records: InspectionRecord[],
  today: string = todayInShanghai(),
): Overview {
  const active = records.filter((r) => r.status === 'ACTIVE');
  const todayRecord = active.find((r) => r.date === today);

  const monday = mondayOf(today);
  const weekRecs = active.filter((r) => r.date >= monday && r.date <= sundayOf(monday));
  const month = monthKeyOf(today);
  const monthRecs = active.filter((r) => monthKeyOf(r.date) === month);

  const weekRate = rateOf(weekRecs.map((r) => computeDaily(r).score));
  const monthRate = rateOf(monthRecs.map((r) => computeDaily(r).score));

  return {
    today: todayRecord ? { date: today, ...computeDaily(todayRecord) } : null,
    weekRate:
      weekRate === null
        ? null
        : { label: weekLabel(monday), rate: weekRate, days: weekRecs.length },
    monthRate:
      monthRate === null ? null : { label: month, rate: monthRate, days: monthRecs.length },
  };
}
