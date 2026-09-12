// 会话仓储：只存令牌哈希
import type { Role } from '@dorm/contracts';

export interface SessionInfo {
  role: Role;
  expiresAt: string;
}

export interface SessionRepository {
  create(tokenHash: string, role: Role, createdAt: string, expiresAt: string): Promise<void>;
  get(tokenHash: string): Promise<SessionInfo | null>;
  delete(tokenHash: string): Promise<void>;
  deleteExpired(): Promise<void>;
}
