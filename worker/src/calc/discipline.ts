// 纪律记录：只展示实际违纪（讲话次数 > 0）的日期（1.md §17、§30）
import type { InspectionRecord } from '../types';

export interface DisciplineRecord {
  date: string;
  talkAm: number;
  talkPm: number;
  count: number;
}

export function disciplineRecords(records: InspectionRecord[]): DisciplineRecord[] {
  return records
    .filter((r) => r.status === 'ACTIVE' && r.talkAm + r.talkPm > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => ({ date: r.date, talkAm: r.talkAm, talkPm: r.talkPm, count: r.talkAm + r.talkPm }));
}
