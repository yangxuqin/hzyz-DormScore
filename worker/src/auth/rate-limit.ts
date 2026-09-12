// 登录限流：Worker 内存按 IP + 角色计数（免费版无集中存储，冷启动会重置）
import { LOGIN_LOCK_SECONDS, LOGIN_MAX_FAILURES } from '../domain/dorm/constants';

interface AttemptRecord {
  failures: number;
  lockedUntil: number;
}

const attempts = new Map<string, AttemptRecord>();

export function checkLoginAllowed(key: string): { allowed: boolean; retryAfterSec: number } {
  const record = attempts.get(key);
  if (!record) return { allowed: true, retryAfterSec: 0 };
  const now = Date.now();
  if (record.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordLoginFailure(key: string): void {
  const now = Date.now();
  const record = attempts.get(key) ?? { failures: 0, lockedUntil: 0 };
  record.failures += 1;
  if (record.failures >= LOGIN_MAX_FAILURES) {
    record.lockedUntil = now + LOGIN_LOCK_SECONDS * 1000;
    record.failures = 0;
  }
  attempts.set(key, record);
}

export function clearLoginAttempts(key: string): void {
  attempts.delete(key);
}

/** 仅测试使用：重置限流状态 */
export function resetLoginAttemptsForTest(): void {
  attempts.clear();
}
