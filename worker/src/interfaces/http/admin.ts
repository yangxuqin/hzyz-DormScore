// 管理接口（ADMIN）：历史查询 / 录入更新 / 撤回恢复 / 日志 / 改密
import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireRole } from '../../auth/middleware';
import { saveInspection } from '../../application/inspections/saveInspection';
import {
  restoreInspection,
  revokeInspection,
  type SetInspectionStatusCommand,
} from '../../application/inspections/setInspectionStatus';
import { changePasswords } from '../../application/settings';
import { isValidDateString } from '../../shared/date';
import { apiError, apiOk } from '../../shared/utils';
import type { AppEnv } from '../../app/context';
import { enrichRecord } from './presenter';
import { respond } from './respond';

const admin = new Hono<AppEnv>();

admin.use('*', requireRole('ADMIN'));

// 历史记录：按日期范围查询（月/周查询由前端换算为 from/to）
admin.get('/inspections', async (c) => {
  const repos = c.get('repos');
  const config = await repos.config.getConfig();
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (from !== undefined && !isValidDateString(from)) {
    return c.json(apiError('INVALID_RANGE', 'from 格式不正确'), 400);
  }
  if (to !== undefined && !isValidDateString(to)) {
    return c.json(apiError('INVALID_RANGE', 'to 格式不正确'), 400);
  }
  const records = await repos.inspections.list(from, to);
  return c.json(apiOk({ records: records.map((r) => enrichRecord(r, config)) }));
});

// 取某日记录（录入页加载 / 更新用）
admin.get('/inspections/by-date', async (c) => {
  const date = c.req.query('date');
  if (!date || !isValidDateString(date)) {
    return c.json(apiError('INVALID_DATE', '日期格式不正确'), 400);
  }
  const repos = c.get('repos');
  const record = await repos.inspections.getByDate(date);
  if (!record) return c.json(apiOk({ record: null }));
  return c.json(apiOk({ record: enrichRecord(record, await repos.config.getConfig()) }));
});

// 录入 / 更新（date 唯一；同一天重复提交 = 更新）
admin.post('/inspections', async (c) => {
  const body = await c.req.json().catch(() => null);
  const id = (body as { id?: unknown } | null)?.id;
  const result = await saveInspection(c.get('repos'), {
    id: typeof id === 'number' ? id : undefined,
    body,
  });
  return respond(c, result);
});

async function setStatusHandler(c: Context<AppEnv>, next: 'REVOKED' | 'ACTIVE'): Promise<Response> {
  const body = await c.req.json().catch(() => null);
  const command: SetInspectionStatusCommand = {
    id: c.req.param('id') ?? '',
    reason: (body as { reason?: unknown } | null)?.reason,
  };
  const result =
    next === 'REVOKED'
      ? await revokeInspection(c.get('repos'), command)
      : await restoreInspection(c.get('repos'), command);
  return respond(c, result);
}

admin.post('/inspections/:id/revoke', (c) => setStatusHandler(c, 'REVOKED'));
admin.post('/inspections/:id/restore', (c) => setStatusHandler(c, 'ACTIVE'));

// 操作日志
admin.get('/audit-logs', async (c) => {
  const limitRaw = Number(c.req.query('limit') ?? 50);
  const offsetRaw = Number(c.req.query('offset') ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  return c.json(apiOk(await c.get('repos').audit.list(limit, offset)));
});

// 修改密码（需当前管理密码确认）
admin.put('/passwords', async (c) => {
  const body = await c.req.json().catch(() => null);
  return respond(c, await changePasswords(c.get('repos'), body));
});

export default admin;
