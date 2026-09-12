// 展示接口（VIEWER 只读）：概览 / 趋势 / 日历 / 单日 / 个人 / 频次 / 纪律
import { Hono } from 'hono';
import { requireRole } from '../../auth/middleware';
import { getOverview } from '../../application/statistics/overview';
import {
  getDailyTrend,
  getMonthlyTrend,
  getWeeklyTrend,
} from '../../application/statistics/trends';
import { getCalendar, getDayDetail } from '../../application/statistics/calendar';
import { getPersonalStats } from '../../application/statistics/personal';
import { getFrequencyStats } from '../../application/statistics/frequency';
import { getDisciplineRecords } from '../../application/statistics/discipline';
import { isValidDateString } from '../../shared/date';
import { apiError, apiOk } from '../../shared/utils';
import type { AppEnv } from '../../app/context';
import { parseMonthParam } from './respond';

const viewer = new Hono<AppEnv>();

viewer.use('*', requireRole('VIEWER'));

viewer.get('/overview', async (c) => c.json(apiOk(await getOverview(c.get('repos')))));

viewer.get('/calendar', async (c) => {
  const month = parseMonthParam(c);
  if (month !== null && typeof month === 'object') {
    return c.json(apiError('INVALID_MONTH', month.error), 400);
  }
  return c.json(apiOk(await getCalendar(c.get('repos'), month)));
});

viewer.get('/day', async (c) => {
  const date = c.req.query('date');
  if (!date || !isValidDateString(date)) {
    return c.json(apiError('INVALID_DATE', '日期格式应为 YYYY-MM-DD'), 400);
  }
  return c.json(apiOk(await getDayDetail(c.get('repos'), date)));
});

viewer.get('/trend/daily', async (c) =>
  c.json(apiOk({ points: await getDailyTrend(c.get('repos')) })),
);
viewer.get('/trend/weekly', async (c) =>
  c.json(apiOk({ points: await getWeeklyTrend(c.get('repos')) })),
);
viewer.get('/trend/monthly', async (c) =>
  c.json(apiOk({ points: await getMonthlyTrend(c.get('repos')) })),
);

viewer.get('/personal', async (c) => {
  const month = parseMonthParam(c);
  if (month !== null && typeof month === 'object') {
    return c.json(apiError('INVALID_MONTH', month.error), 400);
  }
  return c.json(apiOk(await getPersonalStats(c.get('repos'), month)));
});

viewer.get('/frequency', async (c) => {
  const month = parseMonthParam(c);
  if (month !== null && typeof month === 'object') {
    return c.json(apiError('INVALID_MONTH', month.error), 400);
  }
  return c.json(apiOk(await getFrequencyStats(c.get('repos'), month)));
});

viewer.get('/discipline', async (c) =>
  c.json(apiOk({ records: await getDisciplineRecords(c.get('repos')) })),
);

export default viewer;
