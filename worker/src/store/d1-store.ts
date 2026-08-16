// D1（SQLite）存储实现
import type {
  AppConfig,
  AuditLogEntry,
  BedRow,
  InspectionInput,
  InspectionRecord,
  UserRow,
} from '../types';
import type { InspectionStatus, PasswordKey, Role } from '../constants';
import type { AuditLogInput, SessionInfo, Store } from './store';

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0);
}
function str(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}

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

export class D1Store implements Store {
  constructor(private readonly db: D1Database) {}

  async getConfig(): Promise<AppConfig> {
    const [bedsRes, usersRes] = await Promise.all([
      this.db.prepare('SELECT id, name, type, sort FROM beds ORDER BY sort').all(),
      this.db.prepare('SELECT id, name, bed_id, position, sort FROM users ORDER BY sort').all(),
    ]);
    const beds: BedRow[] = bedsRes.results.map((r) => ({
      id: num(r.id),
      name: str(r.name),
      type: str(r.type) as BedRow['type'],
      sort: num(r.sort),
    }));
    const users: UserRow[] = usersRes.results.map((r) => ({
      id: num(r.id),
      name: str(r.name),
      bedId: num(r.bed_id),
      position: str(r.position) as UserRow['position'],
      sort: num(r.sort),
    }));
    return { beds, users };
  }

  async updateMembers(users: UserRow[]): Promise<void> {
    const stmt = this.db.prepare(
      'UPDATE users SET name = ?, bed_id = ?, position = ? WHERE id = ?',
    );
    await this.db.batch(users.map((u) => stmt.bind(u.name, u.bedId, u.position, u.id)));
  }

  async getPasswordHash(key: PasswordKey): Promise<string | null> {
    const row = await this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .bind(`${key}_password_hash`)
      .first<{ value: string }>();
    return row ? row.value : null;
  }

  async setPasswordHash(key: PasswordKey, hash: string): Promise<void> {
    await this.db
      .prepare('UPDATE settings SET value = ? WHERE key = ?')
      .bind(hash, `${key}_password_hash`)
      .run();
  }

  private rangeWhere(from?: string, to?: string): { where: string; params: string[] } {
    if (from && to) return { where: 'WHERE di.date BETWEEN ? AND ?', params: [from, to] };
    if (from) return { where: 'WHERE di.date >= ?', params: [from] };
    if (to) return { where: 'WHERE di.date <= ?', params: [to] };
    return { where: '', params: [] };
  }

  async listInspections(from?: string, to?: string): Promise<InspectionRecord[]> {
    const { where, params } = this.rangeWhere(from, to);
    const rows = await this.db
      .prepare(`SELECT * FROM daily_inspections di ${where} ORDER BY di.date`)
      .bind(...params)
      .all<InspectionTableRow>();

    const records = new Map<number, InspectionRecord>();
    for (const r of rows.results) {
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

    const [statusRes, bedRes, publicRes] = await Promise.all([
      this.db
        .prepare(
          `SELECT dus.inspection_id, dus.user_id, dus.status FROM daily_user_status dus JOIN daily_inspections di ON di.id = dus.inspection_id ${where}`,
        )
        .bind(...params)
        .all(),
      this.db
        .prepare(
          `SELECT bc.inspection_id, bc.period, bc.bed_id, bc.item FROM inspection_bed_checks bc JOIN daily_inspections di ON di.id = bc.inspection_id ${where}`,
        )
        .bind(...params)
        .all(),
      this.db
        .prepare(
          `SELECT pc.inspection_id, pc.period, pc.item FROM inspection_public_checks pc JOIN daily_inspections di ON di.id = pc.inspection_id ${where}`,
        )
        .bind(...params)
        .all(),
    ]);

    for (const r of statusRes.results) {
      records.get(num(r.inspection_id))?.userStatus.push({
        userId: num(r.user_id),
        status: str(r.status) as 'NORMAL' | 'LEAVE',
      });
    }
    for (const r of bedRes.results) {
      records.get(num(r.inspection_id))?.bedChecks.push({
        period: str(r.period) as 'AM' | 'PM',
        bedId: num(r.bed_id),
        item: str(r.item) as 'BED' | 'FLOOR',
      });
    }
    for (const r of publicRes.results) {
      records.get(num(r.inspection_id))?.publicChecks.push({
        period: str(r.period) as 'AM' | 'PM',
        item: str(r.item) as InspectionRecord['publicChecks'][number]['item'],
      });
    }
    return [...records.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async getInspectionByDate(date: string): Promise<InspectionRecord | null> {
    const list = await this.listInspections(date, date);
    return list.find((r) => r.date === date) ?? null;
  }

  async getInspectionById(id: number): Promise<InspectionRecord | null> {
    const list = await this.listInspections();
    return list.find((r) => r.id === id) ?? null;
  }

  /**
   * 按 date 唯一键 upsert（同一天重复提交 = 更新）。
   * D1 batch 顺序执行且原子回滚；子表先按日期清空再插入。
   */
  async upsertInspection(input: InspectionInput): Promise<InspectionRecord> {
    const now = new Date().toISOString();
    const byDate = this.db.prepare(
      `INSERT INTO daily_inspections (date, duty_user_id, talk_am, talk_pm, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         duty_user_id = excluded.duty_user_id,
         talk_am = excluded.talk_am,
         talk_pm = excluded.talk_pm,
         status = 'ACTIVE',
         updated_at = excluded.updated_at`,
    );
    const delStatus = this.db.prepare(
      'DELETE FROM daily_user_status WHERE inspection_id = (SELECT id FROM daily_inspections WHERE date = ?)',
    );
    const delBed = this.db.prepare(
      'DELETE FROM inspection_bed_checks WHERE inspection_id = (SELECT id FROM daily_inspections WHERE date = ?)',
    );
    const delPublic = this.db.prepare(
      'DELETE FROM inspection_public_checks WHERE inspection_id = (SELECT id FROM daily_inspections WHERE date = ?)',
    );
    const insStatus = this.db.prepare(
      'INSERT INTO daily_user_status (inspection_id, user_id, status) SELECT id, ?, ? FROM daily_inspections WHERE date = ?',
    );
    const insBed = this.db.prepare(
      'INSERT INTO inspection_bed_checks (inspection_id, period, bed_id, item) SELECT id, ?, ?, ? FROM daily_inspections WHERE date = ?',
    );
    const insPublic = this.db.prepare(
      'INSERT INTO inspection_public_checks (inspection_id, period, item) SELECT id, ?, ? FROM daily_inspections WHERE date = ?',
    );

    await this.db.batch([
      byDate.bind(input.date, input.dutyUserId, input.talkAm, input.talkPm, now, now),
      delStatus.bind(input.date),
      delBed.bind(input.date),
      delPublic.bind(input.date),
      ...input.userStatus.map((s) => insStatus.bind(s.userId, s.status, input.date)),
      ...input.bedChecks.map((c) => insBed.bind(c.period, c.bedId, c.item, input.date)),
      ...input.publicChecks.map((c) => insPublic.bind(c.period, c.item, input.date)),
    ]);

    const record = await this.getInspectionByDate(input.date);
    if (!record) throw new Error('upsertInspection: 记录写入失败');
    return record;
  }

  async setInspectionStatus(
    id: number,
    status: InspectionStatus,
  ): Promise<InspectionRecord | null> {
    const result = await this.db
      .prepare('UPDATE daily_inspections SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, new Date().toISOString(), id)
      .run();
    if (!result.meta.rows_written) return null;
    return this.getInspectionById(id);
  }

  async createSession(
    tokenHash: string,
    role: Role,
    createdAt: string,
    expiresAt: string,
  ): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO sessions (token_hash, role, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .bind(tokenHash, role, createdAt, expiresAt)
      .run();
  }

  async getSession(tokenHash: string): Promise<SessionInfo | null> {
    const row = await this.db
      .prepare('SELECT role, expires_at FROM sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .first<{ role: Role; expires_at: string }>();
    return row ? { role: row.role, expiresAt: row.expires_at } : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE expires_at <= ?')
      .bind(new Date().toISOString())
      .run();
  }

  async addAuditLog(log: AuditLogInput): Promise<void> {
    await this.db
      .prepare(
        'INSERT INTO audit_logs (operator, action, target, before_json, after_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
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

  async listAuditLogs(
    limit: number,
    offset: number,
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    const [rowsRes, countRes] = await Promise.all([
      this.db
        .prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?')
        .bind(limit, offset)
        .all(),
      this.db.prepare('SELECT COUNT(*) AS total FROM audit_logs').first<{ total: number }>(),
    ]);
    const logs: AuditLogEntry[] = rowsRes.results.map((r) => ({
      id: num(r.id),
      operator: str(r.operator),
      action: str(r.action) as AuditLogEntry['action'],
      target: str(r.target),
      beforeJson: r.before_json === null ? null : str(r.before_json),
      afterJson: r.after_json === null ? null : str(r.after_json),
      reason: r.reason === null ? null : str(r.reason),
      createdAt: str(r.created_at),
    }));
    return { logs, total: countRes?.total ?? 0 };
  }
}
