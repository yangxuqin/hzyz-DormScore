// 类型化 API 端点：页面/feature 通过这些函数访问后端，不直接拼路径
import type {
  AppConfig,
  AuditLogsData,
  CalendarStats,
  ChangePasswordBody,
  DailyTrendPoint,
  DisciplineRecord,
  EnrichedRecord,
  FrequencyStats,
  LoginBody,
  MemberInput,
  MonthlyTrendPoint,
  OverviewData,
  PersonalStats,
  Role,
  SaveInspectionBody,
  SaveInspectionResult,
  WeeklyTrendPoint,
} from '@dorm/contracts';
import { apiGet, apiPost, apiPut } from './client';

export const authApi = {
  login: (body: LoginBody) => apiPost<{ role: Role }>('/auth/login', body),
  logout: () => apiPost<null>('/auth/logout'),
  me: () => apiGet<{ role: Role | null }>('/auth/me'),
};

export const configApi = {
  get: () => apiGet<AppConfig>('/config'),
  updateMembers: (users: MemberInput[]) => apiPut<AppConfig>('/config/members', { users }),
};

export const statsApi = {
  overview: () => apiGet<OverviewData>('/stats/overview'),
  calendar: (month?: string | null) => apiGet<CalendarStats>('/stats/calendar', { month }),
  day: (date: string) => apiGet<EnrichedRecord | null>('/stats/day', { date }),
  dailyTrend: () => apiGet<{ points: DailyTrendPoint[] }>('/stats/trend/daily'),
  weeklyTrend: () => apiGet<{ points: WeeklyTrendPoint[] }>('/stats/trend/weekly'),
  monthlyTrend: () => apiGet<{ points: MonthlyTrendPoint[] }>('/stats/trend/monthly'),
  personal: (month?: string | null) => apiGet<PersonalStats>('/stats/personal', { month }),
  frequency: (month?: string | null) => apiGet<FrequencyStats>('/stats/frequency', { month }),
  discipline: () => apiGet<{ records: DisciplineRecord[] }>('/stats/discipline'),
};

export const adminApi = {
  listInspections: (from?: string, to?: string) =>
    apiGet<{ records: EnrichedRecord[] }>('/admin/inspections', { from, to }),
  inspectionByDate: (date: string) =>
    apiGet<{ record: EnrichedRecord | null }>('/admin/inspections/by-date', { date }),
  saveInspection: (body: SaveInspectionBody) =>
    apiPost<SaveInspectionResult>('/admin/inspections', body),
  revoke: (id: number, reason: string) =>
    apiPost<{ record: EnrichedRecord; action: 'updated' | 'unchanged' }>(
      `/admin/inspections/${id}/revoke`,
      { reason },
    ),
  restore: (id: number, reason: string) =>
    apiPost<{ record: EnrichedRecord; action: 'updated' | 'unchanged' }>(
      `/admin/inspections/${id}/restore`,
      { reason },
    ),
  auditLogs: (limit: number, offset: number) =>
    apiGet<AuditLogsData>('/admin/audit-logs', { limit, offset }),
  changePasswords: (body: ChangePasswordBody) => apiPut<null>('/admin/passwords', body),
};
