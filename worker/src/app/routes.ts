// 路由挂载：集中声明 API 前缀与子路由
import type { Hono } from 'hono';
import type { AppEnv } from './context';

export interface RouteModules {
  auth: Hono<AppEnv>;
  config: Hono<AppEnv>;
  viewer: Hono<AppEnv>;
  admin: Hono<AppEnv>;
}

export function createRoutes(app: Hono<AppEnv>, routes: RouteModules): void {
  app.route('/api/auth', routes.auth);
  app.route('/api/config', routes.config);
  app.route('/api/stats', routes.viewer);
  app.route('/api/admin', routes.admin);
}
