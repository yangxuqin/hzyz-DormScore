// 周期统计（纯函数）：概览 / 趋势 / 日历 / 频次 / 纪律
import { BASE_SCORE, HYGIENE_FREQUENCY_ITEMS } from './constants';
import {
  daysInMonth,
  mondayOf,
  monthKeyOf,
  sundayOf,
  weekdayOf,
  weekLabel,
} from '../../shared/date';
import type { InspectionRecord } from './model';
import { computeDaily, type DailyResult } from './scoring';

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- 趋势 ----

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
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
}

export interface WeeklyPoint {
  /** 周一日期 */
  key: string;
  /** 08/10-08/16 */
  label: string;
  rate: number;
  days: number;
}

export interface MonthlyPoint {
  key: string;
  label: string;
  rate: number;
  days: number;
}

export function activeRecords(records: InspectionRecord[]): InspectionRecord[] {
  return records.filter((r) => r.status === 'ACTIVE');
}

export function dailyTrend(records: InspectionRecord[]): DailyPoint[] {
  return activeRecords(records)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const d = computeDaily(r);
      return {
        date: r.date,
        score: d.score,
        totalDeduction: d.totalDeduction,
        bedDeduction: d.bedDeduction,
        publicDeduction: d.publicDeduction,
        disciplineDeduction: d.disciplineDeduction,
        talkCount: d.talkCount,
      };
    });
}

function groupTrend(
  records: InspectionRecord[],
  keyOf: (r: InspectionRecord) => string,
  labelOf: (key: string) => string,
): (WeeklyPoint | MonthlyPoint)[] {
  const groups = new Map<string, InspectionRecord[]>();
  for (const r of records) {
    if (r.status !== 'ACTIVE') continue;
    const key = keyOf(r);
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  const points: (WeeklyPoint | MonthlyPoint)[] = [];
  for (const [key, recs] of groups) {
    const rate = rateOf(recs.map((r) => computeDaily(r).score));
    if (rate !== null) points.push({ key, label: labelOf(key), rate, days: recs.length });
  }
  return points.sort((a, b) => a.key.localeCompare(b.key));
}

export function weeklyTrend(records: InspectionRecord[]): WeeklyPoint[] {
  return groupTrend(records, (r) => mondayOf(r.date), weekLabel);
}

export function monthlyTrend(records: InspectionRecord[]): MonthlyPoint[] {
  return groupTrend(
    records,
    (r) => monthKeyOf(r.date),
    (k) => k,
  );
}

/** 所有有有效记录的月份（升序），供月份切换器使用 */
export function monthKeysWithRecords(records: InspectionRecord[]): string[] {
  return [...new Set(activeRecords(records).map((r) => monthKeyOf(r.date)))].sort();
}

// ---- 概览 ----

export interface PeriodRateInfo {
  label: string;
  rate: number;
  days: number;
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

export function findActiveByDate(
  records: InspectionRecord[],
  date: string,
): InspectionRecord | null {
  return records.find((r) => r.status === 'ACTIVE' && r.date === date) ?? null;
}

export function computeOverview(records: InspectionRecord[], today: string): Overview {
  const active = activeRecords(records);
  const todayRecord = findActiveByDate(active, today);
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

// ---- 日历 ----

export interface CalendarDayPoint {
  date: string;
  /** 1=周一 … 7=周日 */
  weekday: number;
  score: number | null;
}

export function monthCalendar(records: InspectionRecord[], month: string): CalendarDayPoint[] {
  const byDate = new Map<string, InspectionRecord>();
  for (const r of records) if (r.status === 'ACTIVE') byDate.set(r.date, r);

  const total = daysInMonth(month);
  const days: CalendarDayPoint[] = [];
  for (let d = 1; d <= total; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const rec = byDate.get(date);
    days.push({ date, weekday: weekdayOf(date), score: rec ? computeDaily(rec).score : null });
  }
  return days;
}

// ---- 卫生频次 ----

export interface FrequencyItemView {
  key: string;
  label: string;
  count: number;
}

/**
 * 统计各检查项目发生次数（不是扣分金额）。
 * 一个扣分池按「一次」计入其区域项；上午 + 下午同一项目各算一次。
 */
export function computeFrequency(records: InspectionRecord[]): FrequencyItemView[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const pool of r.bedChecks) counts.set(pool.item, (counts.get(pool.item) ?? 0) + 1);
    for (const c of r.publicChecks) counts.set(c.item, (counts.get(c.item) ?? 0) + 1);
  }
  return HYGIENE_FREQUENCY_ITEMS.map(({ key, label }) => ({
    key,
    label,
    count: counts.get(key) ?? 0,
  }));
}

// ---- 纪律 ----

export interface DisciplineRecordView {
  date: string;
  talkAm: number;
  talkPm: number;
  count: number;
}

/** 只展示实际违纪（讲话次数 > 0）的日期，按日期倒序 */
export function disciplineRecords(records: InspectionRecord[]): DisciplineRecordView[] {
  return activeRecords(records)
    .filter((r) => r.talkAm + r.talkPm > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({
      date: r.date,
      talkAm: r.talkAm,
      talkPm: r.talkPm,
      count: r.talkAm + r.talkPm,
    }));
}

export type { DailyResult };
