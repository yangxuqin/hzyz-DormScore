// 管理端接口：全部要求 ADMIN 会话（1.md §31-§37）
import { Hono } from 'hono';
import type { Context } from 'hono';
import { OPERATOR_NAME, type InspectionStatus } from '../constants';
import type { AuditAction } from '../types';
import { hashPassword, verifyPassword } from '../auth/password';
import { todayInShanghai } from '../date';
import { requireRole } from '../middleware/auth';
import { enrichRecord, normalizeRecord } from '../present';
import { validateInspectionInput, validatePasswordChangeInput } from '../validation';
import { apiError, apiOk } from '../utils';
import type { AppEnv, InspectionRecord } from '../types';
import type { Store } from '../store/store';

const admin = new Hono<AppEnv>();

admin.use('*', requireRole('ADMIN'));

// 历史记录：按日期范围查询（月/周查询由前端换算为 from/to）
admin.get('/inspections', async (c) => {
  const store = c.get('store');
  const config = await store.getConfig();
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (from !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(from))
    return c.json(apiError('INVALID_RANGE', 'from 格式不正确'), 400);
  if (to !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return c.json(apiError('INVALID_RANGE', 'to 格式不正确'), 400);
  const records = await store.listInspections(from, to);
  return c.json(apiOk({ records: records.map((r) => enrichRecord(r, config)) }));
});

// 取某日记录（录入页加载/更新用）
admin.get('/inspections/by-date', async (c) => {
  const date = c.req.query('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return c.json(apiError('INVALID_DATE', '日期格式不正确'), 400);
  const store = c.get('store');
  const record = await store.getInspectionByDate(date);
  if (!record) return c.json(apiOk({ record: null }));
  return c.json(apiOk({ record: enrichRecord(record, await store.getConfig()) }));
});

// 录入 / 更新（date 唯一；同一天重复提交 = 更新，1.md §15 确认）
admin.post('/inspections', async (c) => {
  const store = c.get('store');
  const config = await store.getConfig();
  const body = await c.req.json().catch(() => null);
  const parsed = validateInspectionInput(body, config, todayInShanghai());
  if (!parsed.ok) return c.json(apiError(parsed.code, parsed.message), 400);
  const value = parsed.value;

  const bodyId = (body as { id?: unknown })?.id;
  let target: InspectionRecord | null = null;
  if (typeof bodyId === 'number' && Number.isInteger(bodyId)) {
    target = await store.getInspectionById(bodyId);
    if (!target) return c.json(apiError('NOT_FOUND', '记录不存在'), 404);
    if (target.date !== value.date) {
      const conflicting = await store.getInspectionByDate(value.date);
      if (conflicting && conflicting.id !== target.id) {
        return c.json(apiError('DATE_CONFLICT', '目标日期已存在另一条记录'), 409);
      }
    }
  } else {
    target = await store.getInspectionByDate(value.date);
  }

  const before = target ? normalizeRecord(target) : null;
  const record = await store.upsertInspection(value);
  const after = normalizeRecord(record);
  const action: AuditAction = target ? 'UPDATE' : 'CREATE';
  const changed = target === null || JSON.stringify(before) !== JSON.stringify(after);
  if (changed) {
    const reasonRaw = (body as { reason?: unknown })?.reason;
    await store.addAuditLog({
      operator: OPERATOR_NAME,
      action,
      target: `inspection:${value.date}`,
      beforeJson: target ? JSON.stringify(before) : null,
      afterJson: JSON.stringify(after),
      reason: typeof reasonRaw === 'string' && reasonRaw.trim() !== '' ? reasonRaw.trim() : null,
    });
  }
  return c.json(
    apiOk({
      record: enrichRecord(record, config),
      action: target ? (changed ? 'updated' : 'unchanged') : 'created',
    }),
  );
});

async function setStatus(
  c: Context<AppEnv>,
  idParam: string,
  next: InspectionStatus,
  auditAction: AuditAction,
): Promise<Response> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return c.json(apiError('INVALID_ID', '无效的记录 ID'), 400);
  const store = c.get('store');
  const record = await store.getInspectionById(id);
  if (!record) return c.json(apiError('NOT_FOUND', '记录不存在'), 404);
  if (record.status === next) {
    return c.json(
      apiOk({ record: enrichRecord(record, await store.getConfig()), action: 'unchanged' }),
    );
  }
  const body = await c.req.json().catch(() => null);
  const reasonRaw = (body as { reason?: unknown })?.reason;
  const reason = typeof reasonRaw === 'string' && reasonRaw.trim() !== '' ? reasonRaw.trim() : null;
  const updated = (await store.setInspectionStatus(id, next))!;
  await store.addAuditLog({
    operator: OPERATOR_NAME,
    action: auditAction,
    target: `inspection:${record.date}`,
    beforeJson: JSON.stringify({ status: record.status }),
    afterJson: JSON.stringify({ status: next }),
    reason,
  });
  return c.json(
    apiOk({ record: enrichRecord(updated, await store.getConfig()), action: 'updated' }),
  );
}

admin.post('/inspections/:id/revoke', async (c) =>
  setStatus(c, c.req.param('id'), 'REVOKED', 'REVOKE'),
);
admin.post('/inspections/:id/restore', async (c) =>
  setStatus(c, c.req.param('id'), 'ACTIVE', 'RESTORE'),
);

// 操作日志
admin.get('/audit-logs', async (c) => {
  const limitRaw = Number(c.req.query('limit') ?? 50);
  const offsetRaw = Number(c.req.query('offset') ?? 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  return c.json(apiOk(await c.get('store').listAuditLogs(limit, offset)));
});

// 修改密码（需当前管理密码确认）
admin.put('/passwords', async (c) => {
  const store = c.get('store');
  const body = await c.req.json().catch(() => null);
  const parsed = validatePasswordChangeInput(body);
  if (!parsed.ok) return c.json(apiError(parsed.code, parsed.message), 400);
  const currentHash = await store.getPasswordHash('admin');
  if (!currentHash || !(await verifyPassword(parsed.value.currentAdminPassword, currentHash))) {
    return c.json(apiError('INVALID_CURRENT_PASSWORD', '当前管理密码不正确'), 401);
  }
  const { viewerPassword, adminPassword } = parsed.value;
  if (viewerPassword) {
    await store.setPasswordHash('viewer', await hashPassword(viewerPassword));
    await store.addAuditLog({
      operator: OPERATOR_NAME,
      action: 'CHANGE_PASSWORD',
      target: 'viewer_password',
      beforeJson: null,
      afterJson: JSON.stringify({ changed: true }),
      reason: null,
    });
  }
  if (adminPassword) {
    await store.setPasswordHash('admin', await hashPassword(adminPassword));
    await store.addAuditLog({
      operator: OPERATOR_NAME,
      action: 'CHANGE_PASSWORD',
      target: 'admin_password',
      beforeJson: null,
      afterJson: JSON.stringify({ changed: true }),
      reason: null,
    });
  }
  return c.json(apiOk(null));
});

export default admin;
