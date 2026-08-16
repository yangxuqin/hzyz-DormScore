// 认证中间件：会话解析、角色隔离（后端强制）、CSRF 防护
import { getCookie } from 'hono/cookie';
import type { Context, MiddlewareHandler } from 'hono';
import { SESSION_COOKIE, type Role } from '../constants';
import { hashToken } from '../auth/session';
import { apiError } from '../utils';
import type { AppEnv } from '../types';

/** 解析当前会话；无效/过期会话返回 null */
export async function resolveSession(
  c: Context<AppEnv>,
): Promise<{ role: Role; tokenHash: string } | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const store = c.get('store');
  const session = await store.getSession(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= new Date().toISOString()) {
    await store.deleteSession(tokenHash);
    return null;
  }
  return { role: session.role, tokenHash };
}

/**
 * 角色隔离：展示会话只能访问只读接口；所有写接口必须 ADMIN。
 * 即使绕过前端直接调用接口，展示权限也无法修改任何数据（1.md §39）。
 */
export function requireRole(minRole: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const session = await resolveSession(c);
    if (!session) return c.json(apiError('UNAUTHORIZED', '未登录或会话已过期'), 401);
    if (minRole === 'ADMIN' && session.role !== 'ADMIN') {
      return c.json(apiError('FORBIDDEN', '需要管理权限'), 403);
    }
    c.set('role', session.role);
    c.set('tokenHash', session.tokenHash);
    await next();
  };
}

/** CSRF：非 GET 请求校验 Origin（本机开发端口豁免） */
export function csrfGuard(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
      return next();
    }
    const origin = c.req.header('Origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host;
        const requestHost = new URL(c.req.url).host;
        const isLocal = requestHost.startsWith('localhost') || requestHost.startsWith('127.0.0.1');
        if (!isLocal && originHost !== requestHost) {
          return c.json(apiError('CSRF_REJECTED', '非法请求来源'), 403);
        }
      } catch {
        return c.json(apiError('CSRF_REJECTED', '非法请求来源'), 403);
      }
    }
    await next();
  };
}
