// 登录限流：进程内存按 IP+角色 计数，5 次失败锁定 10 分钟。
// 免费版无集中式存储，Worker 冷启动会重置计数（基础防护，见 开发计划.md §9）。
import { LOGIN_LOCK_SECONDS, LOGIN_MAX_FAILURES } from '../constants';

interface AttemptEntry {
  count: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptEntry>();

export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return { allowed: true, retryAfterSec: 0 };
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (entry.lockedUntil > 0) entry.count = 0; // 曾锁定且已过期 → 重置计数
  return { allowed: true, retryAfterSec: 0 };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) {
    attempts.set(key, { count: 1, lockedUntil: 0 });
    return;
  }
  if (entry.lockedUntil > now) return; // 已锁定期间不再累计
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_FAILURES) {
    entry.lockedUntil = now + LOGIN_LOCK_SECONDS * 1000;
  }
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}

/** 仅测试用：清空限流状态 */
export function resetLoginAttemptsForTest(): void {
  attempts.clear();
}
