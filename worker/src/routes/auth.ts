// 认证路由：登录（双角色）、注销、当前会话
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { SESSION_COOKIE, SESSION_TTL_SECONDS, type Role } from '../constants';
import { hashPassword, verifyPassword } from '../auth/password';
import { generateToken, hashToken, sessionExpiry } from '../auth/session';
import {
  checkLoginAllowed,
  clearLoginAttempts,
  recordLoginFailure,
} from '../middleware/rate-limit';
import { resolveSession } from '../middleware/auth';
import { apiError, apiOk } from '../utils';
import type { AppEnv } from '../types';

const auth = new Hono<AppEnv>();

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const role = (body as { role?: unknown })?.role;
  const password = (body as { password?: unknown })?.password;
  if (
    (role !== 'VIEWER' && role !== 'ADMIN') ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return c.json(apiError('INVALID_BODY', '请输入密码'), 400);
  }

  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const rateKey = `${ip}:${role}`;
  const check = checkLoginAllowed(rateKey);
  if (!check.allowed) {
    return c.json(
      apiError('RATE_LIMITED', `尝试次数过多，请 ${check.retryAfterSec} 秒后再试`),
      429,
    );
  }

  const store = c.get('store');
  const storedHash = await store.getPasswordHash(role === 'ADMIN' ? 'admin' : 'viewer');
  if (!storedHash) return c.json(apiError('NOT_INITIALIZED', '系统尚未初始化密码'), 500);
  if (!(await verifyPassword(password, storedHash))) {
    recordLoginFailure(rateKey);
    return c.json(apiError('INVALID_PASSWORD', '密码错误'), 401);
  }
  clearLoginAttempts(rateKey);

  const token = generateToken();
  const tokenHash = await hashToken(token);
  await store.deleteExpiredSessions();
  await store.createSession(tokenHash, role, new Date().toISOString(), sessionExpiry());
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return c.json(apiOk({ role: role as Role }));
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.get('store').deleteSession(await hashToken(token));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json(apiOk(null));
});

auth.get('/me', async (c) => {
  const session = await resolveSession(c);
  return c.json(apiOk({ role: session?.role ?? null }));
});

export default auth;
