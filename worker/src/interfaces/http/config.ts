// 配置接口：GET 需任意会话（只读）；成员修改仅 ADMIN
import { Hono } from 'hono';
import { requireRole } from '../../auth/middleware';
import { updateMembers } from '../../application/settings';
import { apiOk } from '../../shared/utils';
import type { AppEnv } from '../../app/context';
import { respond } from './respond';

const config = new Hono<AppEnv>();

config.use('*', requireRole('VIEWER'));

config.get('/', async (c) => c.json(apiOk(await c.get('repos').config.getConfig())));

config.put('/members', requireRole('ADMIN'), async (c) => {
  const body = await c.req.json().catch(() => null);
  return respond(c, await updateMembers(c.get('repos'), body));
});

export default config;
