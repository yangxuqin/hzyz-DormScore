// 配置路由：GET 需任意会话（只读）；成员修改仅 ADMIN
import { Hono } from 'hono';
import { OPERATOR_NAME } from '../constants';
import { requireRole } from '../middleware/auth';
import { validateMembersInput } from '../validation';
import { apiError, apiOk } from '../utils';
import type { AppEnv } from '../types';

const config = new Hono<AppEnv>();

config.use('*', requireRole('VIEWER'));

config.get('/', async (c) => c.json(apiOk(await c.get('store').getConfig())));

config.put('/members', requireRole('ADMIN'), async (c) => {
  const store = c.get('store');
  const current = await store.getConfig();
  const body = await c.req.json().catch(() => null);
  const parsed = validateMembersInput(body, current);
  if (!parsed.ok) return c.json(apiError(parsed.code, parsed.message), 400);
  await store.updateMembers(parsed.value.users);
  await store.addAuditLog({
    operator: OPERATOR_NAME,
    action: 'UPDATE_CONFIG',
    target: 'members',
    beforeJson: JSON.stringify(current.users),
    afterJson: JSON.stringify(parsed.value.users),
    reason: null,
  });
  return c.json(apiOk(await store.getConfig()));
});

export default config;
