import type { BedItem, InspectionStatus, Period, PublicItem, Role, UserStatus } from './constants';
import type { Store } from './store/store';

// ---- 基础配置 ----

export interface BedRow {
  id: number;
  name: string;
  type: 'double' | 'single';
  sort: number;
}

export interface UserRow {
  id: number;
  name: string;
  bedId: number;
  position: 'upper' | 'lower' | 'single';
  sort: number;
}

export interface AppConfig {
  beds: BedRow[];
  users: UserRow[];
}

// ---- 每日检查记录 ----

export interface UserStatusEntry {
  userId: number;
  status: UserStatus;
}

export interface BedCheckEntry {
  period: Period;
  bedId: number;
  item: BedItem;
}

export interface PublicCheckEntry {
  period: Period;
  item: PublicItem;
}

/** 完整的一条每日检查记录（含明细，由 Store 组装） */
export interface InspectionRecord {
  id: number;
  date: string; // YYYY-MM-DD
  dutyUserId: number;
  talkAm: number;
  talkPm: number;
  status: InspectionStatus;
  createdAt: string;
  updatedAt: string;
  userStatus: UserStatusEntry[];
  bedChecks: BedCheckEntry[];
  publicChecks: PublicCheckEntry[];
}

/** 录入/修改时提交的输入数据（未含 id/状态，由服务端确定） */
export interface InspectionInput {
  date: string;
  dutyUserId: number;
  talkAm: number;
  talkPm: number;
  userStatus: UserStatusEntry[];
  bedChecks: BedCheckEntry[];
  publicChecks: PublicCheckEntry[];
}

// ---- 操作日志 ----

export type AuditAction =
  'CREATE' | 'UPDATE' | 'REVOKE' | 'RESTORE' | 'CHANGE_PASSWORD' | 'UPDATE_CONFIG';

export interface AuditLogEntry {
  id: number;
  operator: string;
  action: AuditAction;
  target: string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
  createdAt: string;
}

// ---- Cloudflare 运行环境 ----

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
}

/** Hono 上下文：绑定 + 请求级变量 */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    store: Store;
    role: Role | null;
    tokenHash: string | null;
  };
}
