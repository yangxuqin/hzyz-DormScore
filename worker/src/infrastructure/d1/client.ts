// D1 仓储实现：四个仓储共享同一个 D1Database 连接
import type {
  AppConfig,
  AuditLog,
  BedItem,
  InspectionStatus,
  PasswordKey,
  Period,
  Role,
  UserStatus,
} from '@dorm/contracts';
import type { BedPool, InspectionInput, InspectionRecord, UserRow } from '../../domain/dorm/model';
import { toNum, toStr } from '../../shared/utils';
import type {
  AuditLogInput,
  AuditRepository,
  ConfigRepository,
  InspectionRepository,
  Repositories,
  SessionInfo,
  SessionRepository,
} from '../repositories';
import * as Q from './queries';

interface InspectionTableRow {
  id: number;
  date: string;
  duty_user_id: number;
  talk_am: number;
  talk_pm: number;
  status: InspectionStatus;
  created_at: string;
  updated_at: string;
}

class D1InspectionRepository implements InspectionRepository {
  constructor(private readonly db: D1Database) {}

  private async listWhere(where: string, params: unknown[]): Promise<InspectionRecord[]> {
    const sql = Q.inspectionSelect(where);
    const [rowsRes, statusRes, poolRes, publicRes] = await Promise.all([
      this.db
        .prepare(sql.rows)
        .bind(...params)
        .all<InspectionTableRow>(),
      this.db
        .prepare(sql.status)
        .bind(...params)
        .all(),
      this.db
        .prepare(sql.pools)
        .bind(...params)
        .all(),
      this.db
        .prepare(sql.publics)
        .bind(...params)
        .all(),
    ]);

    const records = new Map<number, InspectionRecord>();
    for (const r of rowsRes.results) {
      records.set(r.id, {
        id: r.id,
        date: r.date,
        dutyUserId: r.duty_user_id,
        talkAm: r.talk_am,
        talkPm: r.talk_pm,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        userStatus: [],
        bedChecks: [],
        publicChecks: [],
      });
    }
    if (records.size === 0) return [];

    for (const r of statusRes.results) {
      records.get(toNum(r.inspection_id))?.userStatus.push({
        userId: toNum(r.user_id),
        status: toStr(r.status) as UserStatus,
      });
    }

    // 扣分池与其命中床位来自 LEFT JOIN，按 check_id 聚合
    const pools = new Map<
      number,
      { inspectionId: number; period: Period; item: BedItem; deduction: number; beds: number[] }
    >();
    for (const r of poolRes.results) {
      const checkId = toNum(r.check_id);
      let entry = pools.get(checkId);
      if (!entry) {
        entry = {
          inspectionId: toNum(r.inspection_id),
          period: toStr(r.period) as Period,
          item: toStr(r.item) as BedItem,
          deduction: toNum(r.deduction_points),
          beds: [],
        };
        pools.set(checkId, entry);
      }
      if (r.bed_id !== null && r.bed_id !== undefined) entry.beds.push(toNum(r.bed_id));
    }
    for (const entry of pools.values()) {
      const pool: BedPool = {
        period: entry.period,
        item: entry.item,
        beds: entry.beds,
        deduction: entry.deduction,
      };
      records.get(entry.inspectionId)?.bedChecks.push(pool);
    }

    for (const r of publicRes.results) {
      records.get(toNum(r.inspection_id))?.publicChecks.push({
        period: toStr(r.period) as Period,
        item: toStr(r.item) as InspectionRecord['publicChecks'][number]['item'],
      });
    }

    return [...records.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  list(from?: string, to?: string): Promise<InspectionRecord[]> {
    if (from && to) return this.listWhere('WHERE di.date BETWEEN ? AND ?', [from, to]);
    if (from) return this.listWhere('WHERE di.date >= ?', [from]);
    if (to) return this.listWhere('WHERE di.date <= ?', [to]);
    return this.listWhere('', []);
  }

  async getByDate(date: string): Promise<InspectionRecord | null> {
    const list = await this.listWhere('WHERE di.date = ?', [date]);
    return list.find((r) => r.date === date) ?? null;
  }

  async getById(id: number): Promise<InspectionRecord | null> {
    const list = await this.listWhere('WHERE di.id = ?', [id]);
    return list[0] ?? null;
  }

  /** 按 date 唯一键 upsert；D1 batch 顺序执行，先清子表再写入 */
  async upsert(input: InspectionInput): Promise<InspectionRecord> {
    const now = new Date().toISOString();
    const db = this.db;
    await db.batch([
      db
        .prepare(Q.UPSERT_INSPECTION)
        .bind(input.date, input.dutyUserId, input.talkAm, input.talkPm, now, now),
      db.prepare(Q.DELETE_POOL_BEDS).bind(input.date),
      db.prepare(Q.DELETE_POOLS).bind(input.date),
      db.prepare(Q.DELETE_PUBLIC).bind(input.date),
      db.prepare(Q.DELETE_STATUS).bind(input.date),
      ...input.userStatus.map((s) =>
        db.prepare(Q.INSERT_STATUS).bind(s.userId, s.status, input.date),
      ),
      ...input.bedChecks.map((p) =>
        db.prepare(Q.INSERT_POOL).bind(p.period, p.item, p.deduction, input.date),
      ),
      // 池必须先落库，床位关联再按 (date, period, item) 回查 check_id
      ...input.bedChecks.flatMap((p) =>
        p.beds.map((bedId) =>
          db.prepare(Q.INSERT_POOL_BED).bind(bedId, input.date, p.period, p.item),
        ),
      ),
      ...input.publicChecks.map((c) =>
        db.prepare(Q.INSERT_PUBLIC).bind(c.period, c.item, input.date),
      ),
    ]);

    const record = await this.getByDate(input.date);
    if (!record) throw new Error('upsertInspection: 记录写入失败');
    return record;
  }

  async setStatus(id: number, status: InspectionStatus): Promise<InspectionRecord | null> {
    const result = await this.db
      .prepare(Q.UPDATE_INSPECTION_STATUS)
      .bind(status, new Date().toISOString(), id)
      .run();
    if (!result.meta.rows_written) return null;
    return this.getById(id);
  }
}

class D1ConfigRepository implements ConfigRepository {
  constructor(private readonly db: D1Database) {}

  async getConfig(): Promise<AppConfig> {
    const [bedsRes, usersRes] = await Promise.all([
      this.db.prepare(Q.SELECT_BEDS).all(),
      this.db.prepare(Q.SELECT_USERS).all(),
    ]);
    return {
      beds: bedsRes.results.map((r) => ({
        id: toNum(r.id),
        name: toStr(r.name),
        type: toStr(r.type) as AppConfig['beds'][number]['type'],
        sort: toNum(r.sort),
      })),
      users: usersRes.results.map((r) => ({
        id: toNum(r.id),
        name: toStr(r.name),
        bedId: toNum(r.bed_id),
        position: toStr(r.position) as UserRow['position'],
        sort: toNum(r.sort),
      })),
    };
  }

  async updateMembers(users: UserRow[]): Promise<void> {
    const stmt = this.db.prepare(Q.UPDATE_USER);
    await this.db.batch(users.map((u) => stmt.bind(u.name, u.bedId, u.position, u.id)));
  }

  async getPasswordHash(key: PasswordKey): Promise<string | null> {
    const row = await this.db
      .prepare(Q.SELECT_PASSWORD)
      .bind(`${key}_password_hash`)
      .first<{ value: string }>();
    return row ? row.value : null;
  }

  async setPasswordHash(key: PasswordKey, hash: string): Promise<void> {
    await this.db.prepare(Q.UPDATE_PASSWORD).bind(hash, `${key}_password_hash`).run();
  }
}

class D1SessionRepository implements SessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(tokenHash: string, role: Role, createdAt: string, expiresAt: string): Promise<void> {
    await this.db.prepare(Q.INSERT_SESSION).bind(tokenHash, role, createdAt, expiresAt).run();
  }

  async get(tokenHash: string): Promise<SessionInfo | null> {
    const row = await this.db
      .prepare(Q.SELECT_SESSION)
      .bind(tokenHash)
      .first<{ role: Role; expires_at: string }>();
    return row ? { role: row.role, expiresAt: row.expires_at } : null;
  }

  async delete(tokenHash: string): Promise<void> {
    await this.db.prepare(Q.DELETE_SESSION).bind(tokenHash).run();
  }

  async deleteExpired(): Promise<void> {
    await this.db.prepare(Q.DELETE_EXPIRED_SESSIONS).bind(new Date().toISOString()).run();
  }
}

class D1AuditRepository implements AuditRepository {
  constructor(private readonly db: D1Database) {}

  async add(log: AuditLogInput): Promise<void> {
    await this.db
      .prepare(Q.INSERT_AUDIT)
      .bind(
        log.operator,
        log.action,
        log.target,
        log.beforeJson,
        log.afterJson,
        log.reason,
        new Date().toISOString(),
      )
      .run();
  }

  async list(limit: number, offset: number): Promise<{ logs: AuditLog[]; total: number }> {
    const [rowsRes, countRes] = await Promise.all([
      this.db.prepare(Q.SELECT_AUDIT).bind(limit, offset).all(),
      this.db.prepare(Q.COUNT_AUDIT).first<{ total: number }>(),
    ]);
    const logs: AuditLog[] = rowsRes.results.map((r) => ({
      id: toNum(r.id),
      operator: toStr(r.operator),
      action: toStr(r.action) as AuditLog['action'],
      target: toStr(r.target),
      beforeJson: r.before_json === null ? null : toStr(r.before_json),
      afterJson: r.after_json === null ? null : toStr(r.after_json),
      reason: r.reason === null ? null : toStr(r.reason),
      createdAt: toStr(r.created_at),
    }));
    return { logs, total: countRes?.total ?? 0 };
  }
}

export function createD1Repositories(db: D1Database): Repositories {
  return {
    inspections: new D1InspectionRepository(db),
    config: new D1ConfigRepository(db),
    sessions: new D1SessionRepository(db),
    audit: new D1AuditRepository(db),
  };
}
