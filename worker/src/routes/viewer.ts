// 展示端接口：全部只读（VIEWER 及以上），无任何写操作（1.md §26、§39）
import { Hono } from 'hono';
import type { Context } from 'hono';
import { computeFrequency } from '../calc/frequency';
import { computePersonalMonthly } from '../calc/personal';
import { computeOverview } from '../calc/overview';
import { monthCalendar } from '../calc/calendar';
import { disciplineRecords } from '../calc/discipline';
import { enrichRecord, todayDetails } from '../present';
import { dailyTrend, monthlyTrend, monthKeysWithRecords, weeklyTrend } from '../calc/trends';
import { todayInShanghai } from '../date';
import { requireRole } from '../middleware/auth';
import { apiError, apiOk } from '../utils';
import type { AppEnv } from '../types';

const viewer = new Hono<AppEnv>();

viewer.use('*', requireRole('VIEWER'));

function parseMonthParam(c: Context<AppEnv>): string | null | { error: string } {
  const raw = c.req.query('month');
  if (raw === undefined || raw === '') return null;
  if (!/^\d{4}-\d{2}$/.test(raw)) return { error: '月份格式应为 YYYY-MM' };
  return raw;
}

viewer.get('/overview', async (c) => {
  const store = c.get('store');
  const records = await store.listInspections();
  const today = todayInShanghai();
  const overview = computeOverview(records, today);
  if (overview.today) {
    // 附加今日明细：值日生、请假人员、上/下午检查项（展示页“今日明细”）
    const record = records.find((r) => r.status === 'ACTIVE' && r.date === today)!;
    overview.today = { ...overview.today, ...todayDetails(record, await store.getConfig()) };
  }
  return c.json(apiOk(overview));
});

// 月份历（日历热力图）：默认当前月；每格返回当天得分，无有效记录为 null
viewer.get('/calendar', async (c) => {
  const store = c.get('store');
  const month = parseMonthParam(c);
  if (month !== null && typeof month === 'object')
    return c.json(apiError('INVALID_MONTH', month.error), 400);
  const records = await store.listInspections();
  const current = todayInShanghai().slice(0, 7);
  const months = [...new Set([...monthKeysWithRecords(records), current])].sort();
  const selected = month ?? current;
  return c.json(apiOk({ selectedMonth: selected, months, days: monthCalendar(records, selected) }));
});

// 单日明细：日历点选后展示当日完整信息（值日生、请假、上/下午检查项、讲话）
viewer.get('/day', async (c) => {
  const store = c.get('store');
  const date = c.req.query('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return c.json(apiError('INVALID_DATE', '日期格式应为 YYYY-MM-DD'), 400);
  const records = await store.listInspections();
  const record = records.find((r) => r.status === 'ACTIVE' && r.date === date);
  if (!record) return c.json(apiOk(null));
  return c.json(apiOk(enrichRecord(record, await store.getConfig())));
});

viewer.get('/trend/daily', async (c) => {
  const records = await c.get('store').listInspections();
  return c.json(apiOk({ points: dailyTrend(records) }));
});

viewer.get('/trend/weekly', async (c) => {
  const records = await c.get('store').listInspections();
  return c.json(apiOk({ points: weeklyTrend(records) }));
});

viewer.get('/trend/monthly', async (c) => {
  const records = await c.get('store').listInspections();
  return c.json(apiOk({ points: monthlyTrend(records) }));
});

viewer.get('/personal', async (c) => {
  const store = c.get('store');
  const month = parseMonthParam(c);
  if (month !== null && typeof month === 'object')
    return c.json(apiError('INVALID_MONTH', month.error), 400);
  const records = await store.listInspections();
  const config = await store.getConfig();
  const months = monthKeysWithRecords(records);
  return c.json(apiOk(computePersonalMonthly(records, config, month, months)));
});

viewer.get('/frequency', async (c) => {
  const store = c.get('store');
  const month = parseMonthParam(c);
  if (month !== null && typeof month === 'object')
    return c.json(apiError('INVALID_MONTH', month.error), 400);
  const records = await store.listInspections();
  const months = monthKeysWithRecords(records);
  const selected = month ?? months[months.length - 1] ?? null;
  const items = selected
    ? computeFrequency(
        records.filter((r) => r.status === 'ACTIVE' && r.date.slice(0, 7) === selected),
      )
    : computeFrequency([]);
  return c.json(apiOk({ selectedMonth: selected, months, items }));
});

viewer.get('/discipline', async (c) => {
  const records = await c.get('store').listInspections();
  return c.json(apiOk({ records: disciplineRecords(records) }));
});

export default viewer;
