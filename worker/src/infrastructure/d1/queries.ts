// D1 SQL 语句集中处：所有查询都在这里，便于审查与调整
import type { InspectionStatus } from '@dorm/contracts';

export const SELECT_BEDS = 'SELECT id, name, type, sort FROM beds ORDER BY sort';
export const SELECT_USERS = 'SELECT id, name, bed_id, position, sort FROM users ORDER BY sort';
export const UPDATE_USER = 'UPDATE users SET name = ?, bed_id = ?, position = ? WHERE id = ?';
export const SELECT_PASSWORD = 'SELECT value FROM settings WHERE key = ?';
export const UPDATE_PASSWORD = 'UPDATE settings SET value = ? WHERE key = ?';

export const INSERT_AUDIT =
  'INSERT INTO audit_logs (operator, action, target, before_json, after_json, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
export const SELECT_AUDIT = 'SELECT * FROM audit_logs ORDER BY id DESC LIMIT ? OFFSET ?';
export const COUNT_AUDIT = 'SELECT COUNT(*) AS total FROM audit_logs';

export const INSERT_SESSION =
  'INSERT INTO sessions (token_hash, role, created_at, expires_at) VALUES (?, ?, ?, ?)';
export const SELECT_SESSION = 'SELECT role, expires_at FROM sessions WHERE token_hash = ?';
export const DELETE_SESSION = 'DELETE FROM sessions WHERE token_hash = ?';
export const DELETE_EXPIRED_SESSIONS = 'DELETE FROM sessions WHERE expires_at <= ?';

export const UPSERT_INSPECTION = `INSERT INTO daily_inspections (date, duty_user_id, talk_am, talk_pm, status, created_at, updated_at)
   VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?)
   ON CONFLICT(date) DO UPDATE SET
     duty_user_id = excluded.duty_user_id,
     talk_am = excluded.talk_am,
     talk_pm = excluded.talk_pm,
     status = 'ACTIVE',
     updated_at = excluded.updated_at`;

const INSPECTION_BY_DATE = '(SELECT id FROM daily_inspections WHERE date = ?)';

export const DELETE_STATUS = `DELETE FROM daily_user_status WHERE inspection_id = ${INSPECTION_BY_DATE}`;
export const DELETE_POOL_BEDS = `DELETE FROM inspection_bed_check_beds WHERE check_id IN (
  SELECT id FROM inspection_bed_checks WHERE inspection_id = ${INSPECTION_BY_DATE})`;
export const DELETE_POOLS = `DELETE FROM inspection_bed_checks WHERE inspection_id = ${INSPECTION_BY_DATE}`;
export const DELETE_PUBLIC = `DELETE FROM inspection_public_checks WHERE inspection_id = ${INSPECTION_BY_DATE}`;

export const INSERT_STATUS =
  'INSERT INTO daily_user_status (inspection_id, user_id, status) SELECT id, ?, ? FROM daily_inspections WHERE date = ?';
export const INSERT_POOL =
  'INSERT INTO inspection_bed_checks (inspection_id, period, item, deduction_points) SELECT id, ?, ?, ? FROM daily_inspections WHERE date = ?';
export const INSERT_POOL_BED = `INSERT INTO inspection_bed_check_beds (check_id, bed_id)
  SELECT c.id, ? FROM inspection_bed_checks c
  WHERE c.inspection_id = ${INSPECTION_BY_DATE} AND c.period = ? AND c.item = ?`;
export const INSERT_PUBLIC =
  'INSERT INTO inspection_public_checks (inspection_id, period, item) SELECT id, ?, ? FROM daily_inspections WHERE date = ?';

export const UPDATE_INSPECTION_STATUS =
  'UPDATE daily_inspections SET status = ?, updated_at = ? WHERE id = ?';

/** 主记录 + 子表联查（where 片段作用于别名 di） */
export function inspectionSelect(where: string): {
  rows: string;
  status: string;
  pools: string;
  publics: string;
} {
  return {
    rows: `SELECT * FROM daily_inspections di ${where} ORDER BY di.date`,
    status: `SELECT dus.inspection_id, dus.user_id, dus.status FROM daily_user_status dus
      JOIN daily_inspections di ON di.id = dus.inspection_id ${where}`,
    pools: `SELECT bc.id AS check_id, bc.inspection_id, bc.period, bc.item, bc.deduction_points, b.bed_id
      FROM inspection_bed_checks bc
      JOIN daily_inspections di ON di.id = bc.inspection_id
      LEFT JOIN inspection_bed_check_beds b ON b.check_id = bc.id
      ${where}
      ORDER BY bc.inspection_id, bc.period, bc.item, b.bed_id`,
    publics: `SELECT pc.inspection_id, pc.period, pc.item FROM inspection_public_checks pc
      JOIN daily_inspections di ON di.id = pc.inspection_id ${where}`,
  };
}

export type { InspectionStatus };
