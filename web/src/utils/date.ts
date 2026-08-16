const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

/** 今天（Asia/Shanghai）的 YYYY-MM-DD */
export function todayInShanghai(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }
  return `${map['year'] ?? ''}-${map['month'] ?? ''}-${map['day'] ?? ''}`;
}

/** 根据日期字符串计算星期（星期一~星期日），与后端时区无关 */
export function weekdayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((s) => Number(s));
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  return WEEKDAYS[date.getUTCDay()] ?? '';
}

/** YYYY-MM-DD → 8月16日 */
export function formatDateCn(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map((s) => Number(s));
  if (!y || !m || !d) return dateStr;
  return `${m}月${d}日`;
}

/** 当前月份 YYYY-MM */
export function currentMonthInShanghai(): string {
  return todayInShanghai().slice(0, 7);
}

/** 某月最后一天 YYYY-MM-DD */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map((s) => Number(s));
  if (!y || !m) return month;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, '0')}`;
}

/** 本周（周一~周日）范围 */
export function currentWeekRange(): { start: string; end: string } {
  const today = todayInShanghai();
  const [y, m, d] = today.split('-').map((s) => Number(s));
  const base = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  const diff = (base.getUTCDay() + 6) % 7;
  const start = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - diff),
  );
  const end = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() - diff + 6),
  );
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

/** ISO 时间 → 本地可读时间 */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}
