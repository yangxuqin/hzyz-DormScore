// 操作日志仓储：全量留痕（前后数据快照 + 原因）
import type { AuditAction, AuditLog } from '@dorm/contracts';

export interface AuditLogInput {
  operator: string;
  action: AuditAction;
  target: string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
}

export interface AuditRepository {
  add(log: AuditLogInput): Promise<void>;
  list(limit: number, offset: number): Promise<{ logs: AuditLog[]; total: number }>;
}
