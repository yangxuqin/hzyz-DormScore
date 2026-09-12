// 密码哈希与会话令牌测试
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/password';
import { generateToken, hashToken, sessionExpiry } from '../src/auth/session';
import { INITIAL_PASSWORD_HASH } from '../src/domain/dorm/constants';

describe('password hash/verify', () => {
  it('哈希后可验证，错误密码失败', async () => {
    const hash = await hashPassword('my-secret-123');
    expect(hash.startsWith('pbkdf2$100000$')).toBe(true);
    expect(await verifyPassword('my-secret-123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('种子哈希与迁移数据一致：初始密码 admin 可验证', async () => {
    expect(await verifyPassword('admin', INITIAL_PASSWORD_HASH)).toBe(true);
    expect(await verifyPassword('Admin', INITIAL_PASSWORD_HASH)).toBe(false);
  });

  it('非法存储格式返回 false', async () => {
    expect(await verifyPassword('admin', '')).toBe(false);
    expect(await verifyPassword('admin', 'md5$abc')).toBe(false);
    expect(await verifyPassword('admin', 'pbkdf2$0$abc$abc')).toBe(false);
    expect(await verifyPassword('admin', 'pbkdf2$999999999$abc$abc')).toBe(false);
  });
});

describe('session token', () => {
  it('令牌哈希为 64 位 hex，同一令牌哈希一致', async () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThan(32);
    expect(await hashToken(token)).toBe(await hashToken(token));
    expect((await hashToken(token)).length).toBe(64);
  });
  it('sessionExpiry 约一年后', () => {
    const ttl = new Date(sessionExpiry()).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(365 * 24 * 60 * 60 * 1000 * 0.99);
  });
});
