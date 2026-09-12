/**
 * DormScore API 契约（前后端共享，纯类型）
 *
 * 这是 worker 与 web 之间的唯一接口语言。任何 API 字段变化都必须先改这里，
 * 再同步 worker（domain/application/interfaces）、web（api/features）与
 * docs/API.md。详见根目录 AGENTS.md「修改 API 时同步哪些文件」。
 */

// ---- 枚举 ----

export type Role = 'VIEWER' | 'ADMIN';
/** 检查时段：上午 / 下午（完全独立计算） */
export type Period = 'AM' | 'PM';
/** 成员当天状态：正常 / 请假 */
export type UserStatus = 'NORMAL' | 'LEAVE';
/** 床位区域检查项：床面 / 床下地面 */
export type BedItem = 'BED' | 'FLOOR';
/** 公共区域检查项（6 项） */
export type PublicItem = 'TRASH' | 'BALCONY' | 'INDOOR' | 'TOILET' | 'SINK' | 'TABLE';
/** 记录状态：有效 / 已撤回 */
export type InspectionStatus = 'ACTIVE' | 'REVOKED';
export type AuditAction =
  'CREATE' | 'UPDATE' | 'REVOKE' | 'RESTORE' | 'CHANGE_PASSWORD' | 'UPDATE_CONFIG';
export type PasswordKey = 'admin' | 'viewer';

// ---- 响应包装 ----

export interface ApiErrorBody {
  code: string;
  message: string;
}

export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

// ---- 基础配置 ----

export interface Bed {
  id: number;
  name: string;
  type: 'double' | 'single';
  sort: number;
}

export interface User {
  id: number;
  name: string;
  bedId: number;
  position: 'upper' | 'lower' | 'single';
  sort: number;
}

export interface AppConfig {
  beds: Bed[];
  users: User[];
}

// ---- 录入输入（POST /api/admin/inspections） ----

export interface UserStatusInput {
  userId: number;
  status: UserStatus;
}

/**
 * ★ 核心领域输入：床位扣分池。
 *
 * 一个扣分池 = 「时段 × 区域」。同一时段同一区域无论命中几张床，都只形成一个池，
 * 固定扣 `deduction` 分（当前规则为 2 分）；`beds` 只决定「谁负责分摊」。
 *
 * 例：{ period: 'AM', item: 'FLOOR', beds: [1, 3] } → 上午床下命中 1、3 床，扣 2 分。
 * 禁止展开为「每张床各扣 2 分」。
 */
export interface BedPoolInput {
  period: Period;
  item: BedItem;
  beds: number[];
}

export interface PublicCheckInput {
  period: Period;
  item: PublicItem;
}

export interface SaveInspectionBody {
  /** 更新已有记录时携带（改日期必需）；省略则按 date 查找 */
  id?: number;
  date: string;
  dutyUserId: number;
  talkAm: number;
  talkPm: number;
  userStatus: UserStatusInput[];
  bedChecks: BedPoolInput[];
  publicChecks: PublicCheckInput[];
  reason?: string;
}

export interface SaveInspectionResult {
  record: EnrichedRecord;
  action: 'created' | 'updated' | 'unchanged';
}

// ---- 记录输出 ----

export interface UserStatusView {
  userId: number;
  userName: string;
  status: UserStatus;
}

/** 扣分池的展示形态：命中床位、固定扣分、责任人员及人均分摊 */
export interface BedPoolView {
  period: Period;
  item: BedItem;
  itemLabel: string;
  /** 命中床位 id（升序） */
  beds: number[];
  /** 命中床位名称，如 ["1床", "3床"] */
  bedNames: string[];
  /** 该池扣分（历史快照） */
  deduction: number;
  /** 该池责任人员（已排除请假）与人均分摊（扣分 ÷ 责任人数） */
  responsibleUsers: { userId: number; name: string; share: number }[];
}

export interface PublicCheckView {
  period: Period;
  item: PublicItem;
  itemLabel: string;
}

export interface EnrichedRecord {
  id: number;
  date: string;
  /** 如 "星期日" */
  weekday: string;
  dutyUserId: number;
  dutyUserName: string;
  status: InspectionStatus;
  talkAm: number;
  talkPm: number;
  userStatus: UserStatusView[];
  /** 床位扣分池（最多 4 个：AM/PM × BED/FLOOR） */
  bedChecks: BedPoolView[];
  publicChecks: PublicCheckView[];
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
  totalDeduction: number;
  score: number;
  createdAt: string;
  updatedAt: string;
}

// ---- 展示统计 ----

export interface PeriodRate {
  label: string;
  rate: number;
  days: number;
  fullScoreDays: number;
}

export interface OverviewData {
  /** 今日无有效记录 → null（前端显示 "-"） */
  today: EnrichedRecord | null;
  weekRate: PeriodRate | null;
  monthRate: PeriodRate | null;
}

export interface DailyTrendPoint {
  date: string;
  score: number;
  totalDeduction: number;
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
}

export interface WeeklyTrendPoint {
  key: string;
  label: string;
  rate: number;
  days: number;
}

export interface MonthlyTrendPoint {
  key: string;
  label: string;
  rate: number;
  days: number;
}

export interface PersonalUser {
  userId: number;
  name: string;
  /** 合计个人扣分（允许小数） */
  deduction: number;
  /** 床位扣分池分摊 */
  bedDeduction: number;
  /** 值日生公共区域扣分 */
  publicDeduction: number;
  /** 本月值日天数 */
  dutyCount: number;
}

export interface PersonalStats {
  selectedMonth: string | null;
  months: string[];
  users: PersonalUser[];
}

export interface CalendarDay {
  date: string;
  /** 1=周一 … 7=周日 */
  weekday: number;
  /** 当日得分；无有效记录（含 REVOKED）为 null */
  score: number | null;
}

export interface CalendarStats {
  selectedMonth: string;
  months: string[];
  days: CalendarDay[];
}

export interface FrequencyItem {
  key: string;
  label: string;
  count: number;
}

export interface FrequencyStats {
  selectedMonth: string | null;
  months: string[];
  items: FrequencyItem[];
}

export interface DisciplineRecord {
  date: string;
  talkAm: number;
  talkPm: number;
  count: number;
}

// ---- 管理：历史 / 日志 / 会话 ----

export interface AuditLog {
  id: number;
  operator: string;
  action: AuditAction;
  target: string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
  createdAt: string;
}

export interface AuditLogsData {
  total: number;
  logs: AuditLog[];
}

export interface AuthMeData {
  role: Role | null;
}

export interface LoginBody {
  role: Role;
  password: string;
}

export interface ChangePasswordBody {
  currentAdminPassword: string;
  viewerPassword?: string;
  adminPassword?: string;
}

export interface MemberInput {
  id: number;
  name: string;
  bedId: number;
  position: 'upper' | 'lower' | 'single';
}
