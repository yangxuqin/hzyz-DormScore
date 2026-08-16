// 与 docs/API.md 完全对应的类型定义

export type Role = 'VIEWER' | 'ADMIN';
export type Period = 'AM' | 'PM';
export type UserStatus = 'NORMAL' | 'LEAVE';
export type BedItem = 'BED' | 'FLOOR';
export type PublicItem = 'TRASH' | 'BALCONY' | 'INDOOR' | 'TOILET' | 'SINK' | 'TABLE';
export type InspectionStatus = 'ACTIVE' | 'REVOKED';
export type AuditAction =
  'CREATE' | 'UPDATE' | 'REVOKE' | 'RESTORE' | 'CHANGE_PASSWORD' | 'UPDATE_CONFIG';

export interface ApiErrorBody {
  code: string;
  message: string;
}

export type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: ApiErrorBody };

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

export interface Config {
  beds: Bed[];
  users: User[];
}

export interface TodayDetailPeriod {
  bedChecks: { bedId: number; bedName: string; item: BedItem; itemLabel: string }[];
  publicChecks: { item: PublicItem; itemLabel: string }[];
  talk: number;
}

export interface TodayOverview {
  date: string;
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
  totalDeduction: number;
  score: number;
  weekday: string;
  dutyUserId: number;
  dutyUserName: string;
  leaveUsers: { userId: number; name: string }[];
  am: TodayDetailPeriod;
  pm: TodayDetailPeriod;
}

export interface PeriodRate {
  label: string;
  rate: number;
  days: number;
  fullScoreDays: number;
}

export interface OverviewData {
  today: TodayOverview | null;
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
  deduction: number;
  bedDeduction: number;
  publicDeduction: number;
  dutyCount: number;
}

export interface PersonalStats {
  selectedMonth: string | null;
  months: string[];
  users: PersonalUser[];
}

export interface CalendarDay {
  date: string;
  weekday: number;
  score: number | null;
}

export interface CalendarStats {
  selectedMonth: string;
  months: string[];
  days: CalendarDay[];
}

export interface FrequencyStats {
  selectedMonth: string | null;
  months: string[];
  items: { key: string; label: string; count: number }[];
}

export interface DisciplineRecord {
  date: string;
  talkAm: number;
  talkPm: number;
  count: number;
}

export interface UserStatusEntry {
  userId: number;
  userName: string;
  status: UserStatus;
}

export interface BedCheck {
  period: Period;
  bedId: number;
  bedName: string;
  item: BedItem;
  itemLabel: string;
}

export interface PublicCheck {
  period: Period;
  item: PublicItem;
  itemLabel: string;
}

export interface EnrichedRecord {
  id: number;
  date: string;
  weekday: string;
  dutyUserId: number;
  dutyUserName: string;
  status: InspectionStatus;
  talkAm: number;
  talkPm: number;
  userStatus: UserStatusEntry[];
  bedChecks: BedCheck[];
  publicChecks: PublicCheck[];
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
  totalDeduction: number;
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveInspectionBody {
  id?: number;
  date: string;
  dutyUserId: number;
  talkAm: number;
  talkPm: number;
  userStatus: { userId: number; status: UserStatus }[];
  bedChecks: { period: Period; bedId: number; item: BedItem }[];
  publicChecks: { period: Period; item: PublicItem }[];
  reason?: string;
}

export interface SaveInspectionResult {
  record: EnrichedRecord;
  action: 'created' | 'updated' | 'unchanged';
}

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

export interface MemberInput {
  id: number;
  name: string;
  bedId: number;
  position: 'upper' | 'lower' | 'single';
}
