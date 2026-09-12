// 认证接口：登录（双角色）、注销、当前会话
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { ApiEnvelope, LoginBody, Role } from '@dorm/contracts';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from '../../domain/dorm/constants';
import { hashPassword, verifyPassword } from '../../auth/password';
import { generateToken, hashToken, sessionExpiry } from '../../auth/session';
import { checkLoginAllowed, clearLoginAttempts, recordLoginFailure } from '../../auth/rate-limit';
import { resolveSession } from '../../auth/middleware';
import { apiError, apiOk, isRecord } from '../../shared/utils';
import type { AppEnv } from '../../app/context';

const auth = new Hono<AppEnv>();

auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!isRecord(body)) return c.json(apiError('INVALID_BODY', '请输入密码'), 400);
  const role = body.role;
  const password = body.password;
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

  const repos = c.get('repos');
  const storedHash = await repos.config.getPasswordHash(role === 'ADMIN' ? 'admin' : 'viewer');
  if (!storedHash) return c.json(apiError('NOT_INITIALIZED', '系统尚未初始化密码'), 500);
  if (!(await verifyPassword(password, storedHash))) {
    recordLoginFailure(rateKey);
    return c.json(apiError('INVALID_PASSWORD', '密码错误'), 401);
  }
  clearLoginAttempts(rateKey);

  const token = generateToken();
  const tokenHash = await hashToken(token);
  await repos.sessions.deleteExpired();
  await repos.sessions.create(tokenHash, role, new Date().toISOString(), sessionExpiry());
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  const data: ApiEnvelope<{ role: Role }> = apiOk({ role });
  return c.json(data);
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.get('repos').sessions.delete(await hashToken(token));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json(apiOk(null));
});

auth.get('/me', async (c) => {
  const session = await resolveSession(c);
  return c.json(apiOk({ role: session?.role ?? null }));
});

export type { LoginBody };
export default auth;
