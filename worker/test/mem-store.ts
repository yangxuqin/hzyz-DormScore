// 内存版仓储：API 集成测试用
import type { AppConfig, AuditLog, InspectionStatus, PasswordKey, Role } from '@dorm/contracts';
import type { InspectionInput, InspectionRecord, UserRow } from '../src/domain/dorm/model';
import type { AuditLogInput, Repositories, SessionInfo } from '../src/infrastructure/repositories';
import { CONFIG, SEED_HASH } from './fixtures';

export class MemStore implements Repositories {
  private beds: AppConfig['beds'];
  private users: UserRow[];
  private inspectionsById = new Map<number, InspectionRecord>();
  private sessionMap = new Map<string, SessionInfo>();
  private logs: AuditLog[] = [];
  private settings = new Map<string, string>();
  private nextInspectionId = 1;
  private nextLogId = 1;

  constructor(config: AppConfig = CONFIG, passwordHash: string = SEED_HASH) {
    this.beds = config.beds.map((b) => ({ ...b }));
    this.users = config.users.map((u) => ({ ...u }));
    this.settings.set('admin_password_hash', passwordHash);
    this.settings.set('viewer_password_hash', passwordHash);
  }

  readonly config: Repositories['config'] = {
    getConfig: async (): Promise<AppConfig> => ({
      beds: this.beds.map((b) => ({ ...b })),
      users: this.users.map((u) => ({ ...u })),
    }),
    updateMembers: async (users: UserRow[]): Promise<void> => {
      this.users = users.map((u) => ({ ...u }));
    },
    getPasswordHash: async (key: PasswordKey): Promise<string | null> =>
      this.settings.get(`${key}_password_hash`) ?? null,
    setPasswordHash: async (key: PasswordKey, hash: string): Promise<void> => {
      this.settings.set(`${key}_password_hash`, hash);
    },
  };

  readonly inspections: Repositories['inspections'] = {
    list: async (from?: string, to?: string): Promise<InspectionRecord[]> =>
      [...this.inspectionsById.values()]
        .filter((r) => (!from || r.date >= from) && (!to || r.date <= to))
        .sort((a, b) => a.date.localeCompare(b.date)),
    getByDate: async (date: string): Promise<InspectionRecord | null> =>
      [...this.inspectionsById.values()].find((r) => r.date === date) ?? null,
    getById: async (id: number): Promise<InspectionRecord | null> =>
      this.inspectionsById.get(id) ?? null,
    upsert: async (input: InspectionInput): Promise<InspectionRecord> => {
      const now = new Date().toISOString();
      const existing = [...this.inspectionsById.values()].find((r) => r.date === input.date);
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
        bedChecks: input.bedChecks.map((p) => ({ ...p, beds: [...p.beds] })),
        publicChecks: input.publicChecks.map((c) => ({ ...c })),
      };
      this.inspectionsById.set(record.id, record);
      return record;
    },
    setStatus: async (id: number, status: InspectionStatus): Promise<InspectionRecord | null> => {
      const record = this.inspectionsById.get(id);
      if (!record) return null;
      record.status = status;
      record.updatedAt = new Date().toISOString();
      return record;
    },
  };

  readonly sessions: Repositories['sessions'] = {
    create: async (
      tokenHash: string,
      role: Role,
      _createdAt: string,
      expiresAt: string,
    ): Promise<void> => {
      this.sessionMap.set(tokenHash, { role, expiresAt });
    },
    get: async (tokenHash: string): Promise<SessionInfo | null> =>
      this.sessionMap.get(tokenHash) ?? null,
    delete: async (tokenHash: string): Promise<void> => {
      this.sessionMap.delete(tokenHash);
    },
    deleteExpired: async (): Promise<void> => {
      const now = new Date().toISOString();
      for (const [k, v] of this.sessionMap) if (v.expiresAt <= now) this.sessionMap.delete(k);
    },
  };

  readonly audit: Repositories['audit'] = {
    add: async (log: AuditLogInput): Promise<void> => {
      this.logs.push({ id: this.nextLogId++, createdAt: new Date().toISOString(), ...log });
    },
    list: async (limit: number, offset: number): Promise<{ logs: AuditLog[]; total: number }> => {
      const sorted = [...this.logs].sort((a, b) => b.id - a.id);
      return { logs: sorted.slice(offset, offset + limit), total: sorted.length };
    },
  };
}
