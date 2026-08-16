// 月份历：每一天的得分（无有效记录为 null），用于展示页日历热力图
import { weekdayOf } from '../date';
import type { InspectionRecord } from '../types';
import { computeDaily } from './daily';

export interface CalendarDay {
  date: string;
  /** 1=周一 … 7=周日 */
  weekday: number;
  /** 当日得分；无有效记录为 null（REVOKED 同样视为无记录） */
  score: number | null;
}

export function monthCalendar(records: InspectionRecord[], month: string): CalendarDay[] {
  const byDate = new Map<string, InspectionRecord>();
  for (const r of records) if (r.status === 'ACTIVE') byDate.set(r.date, r);

  const [y, m] = month.split('-').map((s) => Number(s));
  const daysInMonth = new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate();

  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const rec = byDate.get(date);
    days.push({ date, weekday: weekdayOf(date), score: rec ? computeDaily(rec).score : null });
  }
  return days;
}
