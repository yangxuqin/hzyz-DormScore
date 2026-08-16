// 内存版 Store：API 集成测试用
import type {
  AppConfig,
  AuditLogEntry,
  BedRow,
  InspectionInput,
  InspectionRecord,
  UserRow,
} from '../src/types';
import type { InspectionStatus, PasswordKey, Role } from '../src/constants';
import type { AuditLogInput, SessionInfo, Store } from '../src/store/store';
import { CONFIG, SEED_HASH } from './fixtures';

export class MemStore implements Store {
  private beds: BedRow[];
  private users: UserRow[];
  private inspections = new Map<number, InspectionRecord>();
  private sessions = new Map<string, SessionInfo>();
  private logs: AuditLogEntry[] = [];
  private settings = new Map<string, string>();
  private nextInspectionId = 1;
  private nextLogId = 1;

  constructor(config: AppConfig = CONFIG, passwordHash: string = SEED_HASH) {
    this.beds = config.beds.map((b) => ({ ...b }));
    this.users = config.users.map((u) => ({ ...u }));
    this.settings.set('admin_password_hash', passwordHash);
    this.settings.set('viewer_password_hash', passwordHash);
  }

  async getConfig(): Promise<AppConfig> {
    return { beds: this.beds.map((b) => ({ ...b })), users: this.users.map((u) => ({ ...u })) };
  }

  async updateMembers(users: UserRow[]): Promise<void> {
    this.users = users.map((u) => ({ ...u }));
  }

  async getPasswordHash(key: PasswordKey): Promise<string | null> {
    return this.settings.get(`${key}_password_hash`) ?? null;
  }

  async setPasswordHash(key: PasswordKey, hash: string): Promise<void> {
    this.settings.set(`${key}_password_hash`, hash);
  }

  async listInspections(from?: string, to?: string): Promise<InspectionRecord[]> {
    return [...this.inspections.values()]
      .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getInspectionByDate(date: string): Promise<InspectionRecord | null> {
    return [...this.inspections.values()].find((r) => r.date === date) ?? null;
  }

  async getInspectionById(id: number): Promise<InspectionRecord | null> {
    return this.inspections.get(id) ?? null;
  }

  async upsertInspection(input: InspectionInput): Promise<InspectionRecord> {
    const now = new Date().toISOString();
    const existing = [...this.inspections.values()].find((r) => r.date === input.date);
    const record: InspectionRecord = {
      id: existing?.id ?? this.nextInspectionId++,
      date: input.date,
      dutyUserId: input.dutyUserId,
      talkAm: input.talkAm,
      talkPm: input.talkPm,
      status: 'ACTIVE',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      userStatus: input.userStatus.map((s) => ({ ...s })),
      bedChecks: input.bedChecks.map((c) => ({ ...c })),
      publicChecks: input.publicChecks.map((c) => ({ ...c })),
    };
    this.inspections.set(record.id, record);
    return record;
  }

  async setInspectionStatus(
    id: number,
    status: InspectionStatus,
  ): Promise<InspectionRecord | null> {
    const record = this.inspections.get(id);
    if (!record) return null;
    record.status = status;
    record.updatedAt = new Date().toISOString();
    return record;
  }

  async createSession(
    tokenHash: string,
    role: Role,
    _createdAt: string,
    expiresAt: string,
  ): Promise<void> {
    this.sessions.set(tokenHash, { role, expiresAt });
  }

  async getSession(tokenHash: string): Promise<SessionInfo | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteExpiredSessions(): Promise<void> {
    const now = new Date().toISOString();
    for (const [k, v] of this.sessions) if (v.expiresAt <= now) this.sessions.delete(k);
  }

  async addAuditLog(log: AuditLogInput): Promise<void> {
    this.logs.push({ id: this.nextLogId++, createdAt: new Date().toISOString(), ...log });
  }

  async listAuditLogs(
    limit: number,
    offset: number,
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const sorted = [...this.logs].sort((a, b) => b.id - a.id);
    return { logs: sorted.slice(offset, offset + limit), total: sorted.length };
  }
}
