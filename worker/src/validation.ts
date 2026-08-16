// 服务端输入校验（前后端双重校验的后端部分）
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PUBLIC_ITEMS } from './constants';
import type { BedItem, Period, PublicItem, UserStatus } from './constants';
import { isValidDateString } from './date';
import type {
  AppConfig,
  BedCheckEntry,
  InspectionInput,
  PublicCheckEntry,
  UserRow,
  UserStatusEntry,
} from './types';
import { isNonNegativeInteger } from './utils';

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; code: string; message: string };

function fail(code: string, message: string) {
  return { ok: false as const, code, message };
}

const PERIODS: Period[] = ['AM', 'PM'];
const BED_ITEMS: BedItem[] = ['BED', 'FLOOR'];
const USER_STATUSES: UserStatus[] = ['NORMAL', 'LEAVE'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function validateInspectionInput(
  body: unknown,
  config: AppConfig,
  today: string,
): ValidationResult<InspectionInput> {
  if (!isRecord(body)) return fail('INVALID_BODY', '请求体格式错误');

  const date = body.date;
  if (typeof date !== 'string' || !isValidDateString(date))
    return fail('INVALID_DATE', '日期格式不正确');
  if (date > today) return fail('DATE_IN_FUTURE', '不能录入未来日期');

  const dutyUserId = body.dutyUserId;
  if (!isNonNegativeInteger(dutyUserId)) return fail('INVALID_DUTY_USER', '值日生不正确');
  if (!config.users.some((u) => u.id === dutyUserId))
    return fail('INVALID_DUTY_USER', '值日生不存在');

  const talkAm = body.talkAm;
  const talkPm = body.talkPm;
  if (!isNonNegativeInteger(talkAm) || !isNonNegativeInteger(talkPm)) {
    return fail('INVALID_TALK_COUNT', '讲话次数必须是非负整数');
  }

  const rawStatus = body.userStatus;
  if (!Array.isArray(rawStatus) || rawStatus.length !== config.users.length) {
    return fail('INVALID_USER_STATUS', '必须填写全部成员当天状态');
  }
  const statusById = new Map<number, UserStatus>();
  for (const s of rawStatus) {
    if (
      !isRecord(s) ||
      !isNonNegativeInteger(s.userId) ||
      !USER_STATUSES.includes(s.status as UserStatus)
    ) {
      return fail('INVALID_USER_STATUS', '成员状态数据不正确');
    }
    if (statusById.has(s.userId)) return fail('INVALID_USER_STATUS', '成员状态重复');
    statusById.set(s.userId, s.status as UserStatus);
  }
  for (const u of config.users) {
    if (!statusById.has(u.id)) return fail('INVALID_USER_STATUS', '缺少成员状态');
  }
  if (statusById.get(dutyUserId) !== 'NORMAL') {
    return fail('DUTY_USER_ON_LEAVE', '请假人员不能担任值日生');
  }

  const rawBed = body.bedChecks;
  if (!Array.isArray(rawBed)) return fail('INVALID_BED_CHECK', '床位检查数据格式错误');
  const bedChecks: BedCheckEntry[] = [];
  const bedSeen = new Set<string>();
  for (const c of rawBed) {
    if (
      !isRecord(c) ||
      !PERIODS.includes(c.period as Period) ||
      !isNonNegativeInteger(c.bedId) ||
      !BED_ITEMS.includes(c.item as BedItem)
    ) {
      return fail('INVALID_BED_CHECK', '床位检查数据不正确');
    }
    if (!config.beds.some((b) => b.id === c.bedId)) return fail('INVALID_BED_CHECK', '床位不存在');
    const key = `${c.period}:${c.bedId}:${c.item}`;
    if (bedSeen.has(key)) return fail('INVALID_BED_CHECK', '床位检查项重复');
    bedSeen.add(key);
    bedChecks.push({
      period: c.period as Period,
      bedId: c.bedId as number,
      item: c.item as BedItem,
    });
  }

  const rawPublic = body.publicChecks;
  if (!Array.isArray(rawPublic)) return fail('INVALID_PUBLIC_CHECK', '公共区域检查数据格式错误');
  const publicChecks: PublicCheckEntry[] = [];
  const publicSeen = new Set<string>();
  for (const c of rawPublic) {
    if (
      !isRecord(c) ||
      !PERIODS.includes(c.period as Period) ||
      !(PUBLIC_ITEMS as readonly string[]).includes(c.item as string)
    ) {
      return fail('INVALID_PUBLIC_CHECK', '公共区域检查数据不正确');
    }
    const key = `${c.period}:${c.item}`;
    if (publicSeen.has(key)) return fail('INVALID_PUBLIC_CHECK', '公共区域检查项重复');
    publicSeen.add(key);
    publicChecks.push({ period: c.period as Period, item: c.item as PublicItem });
  }

  return {
    ok: true,
    value: {
      date,
      dutyUserId,
      talkAm,
      talkPm,
      userStatus: config.users.map((u) => ({ userId: u.id, status: statusById.get(u.id)! })),
      bedChecks,
      publicChecks,
    },
  };
}

export function validateMembersInput(
  body: unknown,
  config: AppConfig,
): ValidationResult<{ users: UserRow[] }> {
  if (!isRecord(body) || !Array.isArray(body.users)) return fail('INVALID_BODY', '请求体格式错误');
  const arr = body.users;
  if (arr.length !== config.users.length) {
    return fail('INVALID_MEMBERS', `成员数量必须为 ${config.users.length} 人`);
  }
  const byId = new Map(config.users.map((u) => [u.id, u]));
  const seen = new Set<number>();
  const users: UserRow[] = [];
  for (const item of arr) {
    if (!isRecord(item)) return fail('INVALID_MEMBERS', '成员数据格式错误');
    const { id, name, bedId, position } = item;
    if (!isNonNegativeInteger(id) || !byId.has(id)) return fail('INVALID_MEMBERS', '成员不存在');
    if (seen.has(id)) return fail('INVALID_MEMBERS', '成员重复');
    seen.add(id);
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 20) {
      return fail('INVALID_MEMBERS', '姓名不能为空且不超过 20 字');
    }
    const bed = config.beds.find((b) => b.id === bedId);
    if (!isNonNegativeInteger(bedId) || !bed) return fail('INVALID_MEMBERS', '床位不存在');
    const validPosition =
      bed.type === 'double' ? position === 'upper' || position === 'lower' : position === 'single';
    if (!validPosition) return fail('INVALID_MEMBERS', '铺位与床位类型不匹配');
    users.push({
      id,
      name: name.trim(),
      bedId,
      position: position as UserRow['position'],
      sort: byId.get(id)!.sort,
    });
  }
  for (const bed of config.beds) {
    const occupants = users.filter((u) => u.bedId === bed.id);
    if (bed.type === 'double') {
      const ok =
        occupants.length === 2 &&
        occupants.some((u) => u.position === 'upper') &&
        occupants.some((u) => u.position === 'lower');
      if (!ok) return fail('INVALID_MEMBERS', `${bed.name} 必须有一名上铺和一名下铺成员`);
    } else {
      if (occupants.length !== 1 || occupants[0]!.position !== 'single') {
        return fail('INVALID_MEMBERS', `${bed.name} 必须有一名单人床成员`);
      }
    }
  }
  return { ok: true, value: { users } };
}

export function validatePasswordChangeInput(body: unknown): ValidationResult<{
  currentAdminPassword: string;
  viewerPassword?: string;
  adminPassword?: string;
}> {
  if (!isRecord(body)) return fail('INVALID_BODY', '请求体格式错误');
  const current = body.currentAdminPassword;
  if (typeof current !== 'string' || current.length === 0) {
    return fail('INVALID_CURRENT_PASSWORD', '请输入当前管理密码');
  }
  const viewerPassword = body.viewerPassword;
  const adminPassword = body.adminPassword;
  const hasTarget = viewerPassword !== undefined || adminPassword !== undefined;
  if (!hasTarget) return fail('INVALID_BODY', '至少需要修改一个密码');
  for (const [key, p] of [
    ['viewerPassword', viewerPassword],
    ['adminPassword', adminPassword],
  ] as const) {
    if (p === undefined) continue;
    if (typeof p !== 'string' || p.length < PASSWORD_MIN_LENGTH || p.length > PASSWORD_MAX_LENGTH) {
      return fail(
        'INVALID_PASSWORD',
        `新密码长度需在 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 位之间`,
      );
    }
  }
  const value: { currentAdminPassword: string; viewerPassword?: string; adminPassword?: string } = {
    currentAdminPassword: current,
  };
  if (typeof viewerPassword === 'string') value.viewerPassword = viewerPassword;
  if (typeof adminPassword === 'string') value.adminPassword = adminPassword;
  return { ok: true, value };
}
