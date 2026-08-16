// 成绩概览：今日得分（无记录为 null，前端显示 -）、本周/本月得分率（1.md §27 模块一）
import { BASE_SCORE } from '../constants';
import { mondayOf, monthKeyOf, sundayOf, todayInShanghai, weekLabel } from '../date';
import type { InspectionRecord } from '../types';
import { computeDaily, type DailyResult } from './daily';
import { rateOf } from './trends';

export interface PeriodRateInfo {
  label: string;
  rate: number;
  days: number;
  /** 满分（20 分）天数 */
  fullScoreDays: number;
}

export interface Overview {
  today: ({ date: string } & DailyResult) | null;
  weekRate: PeriodRateInfo | null;
  monthRate: PeriodRateInfo | null;
}

function periodInfo(recs: InspectionRecord[], label: string): PeriodRateInfo | null {
  const scores = recs.map((r) => computeDaily(r).score);
  const rate = rateOf(scores);
  if (rate === null) return null;
  return {
    label,
    rate,
    days: recs.length,
    fullScoreDays: scores.filter((s) => s === BASE_SCORE).length,
  };
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

  return {
    today: todayRecord ? { date: today, ...computeDaily(todayRecord) } : null,
    weekRate: periodInfo(weekRecs, weekLabel(monday)),
    monthRate: periodInfo(monthRecs, month),
  };
}
