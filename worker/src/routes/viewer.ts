// 展示端接口：全部只读（VIEWER 及以上），无任何写操作（1.md §26、§39）
import { Hono } from 'hono';
import type { Context } from 'hono';
import { computeFrequency } from '../calc/frequency';
import { computePersonalMonthly } from '../calc/personal';
import { computeOverview } from '../calc/overview';
import { disciplineRecords } from '../calc/discipline';
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
  return c.json(apiOk(computeOverview(records, todayInShanghai())));
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
