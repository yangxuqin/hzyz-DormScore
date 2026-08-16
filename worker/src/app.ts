// 应用组装：依赖注入 Store 工厂，便于测试替换为内存实现
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { csrfGuard } from './middleware/auth';
import authRoutes from './routes/auth';
import configRoutes from './routes/config';
import viewerRoutes from './routes/viewer';
import adminRoutes from './routes/admin';
import { D1Store } from './store/d1-store';
import type { Store } from './store/store';
import { apiError } from './utils';
import type { AppEnv, Env } from './types';

export type StoreFactory = (env: Env) => Store;

export function createApp(factory: StoreFactory = (env) => new D1Store(env.DB)): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('/api/*', csrfGuard());
  app.use('/api/*', async (c, next) => {
    c.set('store', factory(c.env));
    await next();
  });

  app.route('/api/auth', authRoutes);
  app.route('/api/config', configRoutes);
  app.route('/api/stats', viewerRoutes);
  app.route('/api/admin', adminRoutes);

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
