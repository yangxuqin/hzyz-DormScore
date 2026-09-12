// 日期工具：业务日期一律按 Asia/Shanghai 处理，存储格式固定为 YYYY-MM-DD
export const TIMEZONE = 'Asia/Shanghai';

/** 中国时区的“今天”（YYYY-MM-DD） */
export function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** 星期（1=周一 … 7=周日），对日期字符串的确定性计算，与时区无关 */
export function weekdayOf(date: string): number {
  const d = new Date(date + 'T00:00:00Z');
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export const WEEKDAY_NAMES = [
  '星期一',
  '星期二',
  '星期三',
  '星期四',
  '星期五',
  '星期六',
  '星期日',
] as const;

export function weekdayName(date: string): string {
  return WEEKDAY_NAMES[weekdayOf(date) - 1]!;
}

export function addDays(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 该日期所在周的周一（周一为一周起点） */
export function mondayOf(date: string): string {
  return addDays(date, -(weekdayOf(date) - 1));
}

export function sundayOf(monday: string): string {
  return addDays(monday, 6);
}

/** 周标签，如 08/10-08/16 */
export function weekLabel(monday: string): string {
  const sun = sundayOf(monday);
  const fmt = (s: string) => s.slice(5).replace('-', '/');
  return `${fmt(monday)}-${fmt(sun)}`;
}

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

export function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function isValidMonthString(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

/** 某月天数（YYYY-MM → 28/29/30/31） */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map((s) => Number(s));
  return new Date(Date.UTC(y ?? 0, m ?? 1, 0)).getUTCDate();
}
