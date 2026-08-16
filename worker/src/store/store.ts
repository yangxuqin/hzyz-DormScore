// 数据访问层接口：路由/服务只依赖该接口，便于测试替换为内存实现
import type {
  AppConfig,
  AuditAction,
  AuditLogEntry,
  InspectionInput,
  InspectionRecord,
  UserRow,
} from '../types';
import type { InspectionStatus, PasswordKey, Role } from '../constants';

export interface AuditLogInput {
  operator: string;
  action: AuditAction;
  target: string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
}

export interface SessionInfo {
  role: Role;
  expiresAt: string;
}

export interface Store {
  // 配置
  getConfig(): Promise<AppConfig>;
  updateMembers(users: UserRow[]): Promise<void>;
  getPasswordHash(key: PasswordKey): Promise<string | null>;
  setPasswordHash(key: PasswordKey, hash: string): Promise<void>;
  // 每日检查记录
  listInspections(from?: string, to?: string): Promise<InspectionRecord[]>;
  getInspectionByDate(date: string): Promise<InspectionRecord | null>;
  getInspectionById(id: number): Promise<InspectionRecord | null>;
  upsertInspection(input: InspectionInput): Promise<InspectionRecord>;
  setInspectionStatus(id: number, status: InspectionStatus): Promise<InspectionRecord | null>;
  // 会话
  createSession(tokenHash: string, role: Role, createdAt: string, expiresAt: string): Promise<void>;
  getSession(tokenHash: string): Promise<SessionInfo | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  // 操作日志
  addAuditLog(log: AuditLogInput): Promise<void>;
  listAuditLogs(limit: number, offset: number): Promise<{ logs: AuditLogEntry[]; total: number }>;
}
