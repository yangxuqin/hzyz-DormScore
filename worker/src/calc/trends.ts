// 周期统计：日得分 / 周得分率（周一~周日）/ 月得分率，只统计 ACTIVE 有效日（1.md §23-§25）
import { BASE_SCORE } from '../constants';
import { mondayOf, weekLabel } from '../date';
import type { InspectionRecord } from '../types';
import { computeDaily } from './daily';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** 得分率 = 有效日得分总和 ÷ (20 × 有效天数) × 100% */
export function rateOf(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return round2((sum / (BASE_SCORE * scores.length)) * 100);
}

export interface DailyPoint {
  date: string;
  score: number;
  totalDeduction: number;
}
export interface WeeklyPoint {
  key: string; // 周一日期
  label: string; // 08/10-08/16
  rate: number;
}
export interface MonthlyPoint {
  key: string; // YYYY-MM
  label: string;
  rate: number;
}

export function dailyTrend(records: InspectionRecord[]): DailyPoint[] {
  return records
    .filter((r) => r.status === 'ACTIVE')
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const d = computeDaily(r);
      return { date: r.date, score: d.score, totalDeduction: d.totalDeduction };
    });
}

export function weeklyTrend(records: InspectionRecord[]): WeeklyPoint[] {
  const groups = new Map<string, InspectionRecord[]>();
  for (const r of records) {
    if (r.status !== 'ACTIVE') continue;
    const monday = mondayOf(r.date);
    const arr = groups.get(monday) ?? [];
    arr.push(r);
    groups.set(monday, arr);
  }
  const points: WeeklyPoint[] = [];
  for (const [monday, recs] of groups) {
    const rate = rateOf(recs.map((r) => computeDaily(r).score));
    if (rate !== null) points.push({ key: monday, label: weekLabel(monday), rate });
  }
  return points.sort((a, b) => a.key.localeCompare(b.key));
}

export function monthlyTrend(records: InspectionRecord[]): MonthlyPoint[] {
  const groups = new Map<string, InspectionRecord[]>();
  for (const r of records) {
    if (r.status !== 'ACTIVE') continue;
    const m = r.date.slice(0, 7);
    const arr = groups.get(m) ?? [];
    arr.push(r);
    groups.set(m, arr);
  }
  const points: MonthlyPoint[] = [];
  for (const [m, recs] of groups) {
    const rate = rateOf(recs.map((r) => computeDaily(r).score));
    if (rate !== null) points.push({ key: m, label: m, rate });
  }
  return points.sort((a, b) => a.key.localeCompare(b.key));
}

/** 所有有有效记录的月份（升序），供月份切换器使用 */
export function monthKeysWithRecords(records: InspectionRecord[]): string[] {
  return [
    ...new Set(records.filter((r) => r.status === 'ACTIVE').map((r) => r.date.slice(0, 7))),
  ].sort();
}
