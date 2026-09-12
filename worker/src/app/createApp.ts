// 应用组装：依赖注入 Repositories 工厂，便于测试替换为内存实现
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { csrfGuard } from '../auth/middleware';
import { createD1Repositories } from '../infrastructure/d1/client';
import type { Repositories } from '../infrastructure/repositories';
import { apiError } from '../shared/utils';
import type { AppEnv, Env, RepositoriesFactory } from './context';
import authRoutes from '../interfaces/http/auth';
import configRoutes from '../interfaces/http/config';
import viewerRoutes from '../interfaces/http/viewer';
import adminRoutes from '../interfaces/http/admin';
import { createRoutes } from './routes';

export function createApp(
  factory: RepositoriesFactory = (env) => createD1Repositories(env.DB),
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('/api/*', csrfGuard());
  app.use('/api/*', async (c, next) => {
    c.set('repos', factory(c.env));
    await next();
  });

  createRoutes(app, {
    auth: authRoutes,
    config: configRoutes,
    viewer: viewerRoutes,
    admin: adminRoutes,
  });

  // 前端 SPA：非 /api 请求交给静态资源（未命中时回退 index.html）
  app.notFound((c) => {
    if (new URL(c.req.url).pathname.startsWith('/api/')) {
      return c.json(apiError('NOT_FOUND', '接口不存在'), 404);
    }
    if (c.env.ASSETS) return c.env.ASSETS.fetch(c.req.raw);
    return c.json(apiError('NOT_FOUND', '页面不存在'), 404);
  });

  app.onError((err, c) => {
    console.error('[dorm-score] 未处理错误:', err);
    if (err instanceof HTTPException) {
      return c.json(apiError('HTTP_ERROR', err.message), err.status);
    }
    return c.json(apiError('INTERNAL', '服务器内部错误'), 500);
  });

  return app;
}

export type { Env, Repositories, RepositoriesFactory };
