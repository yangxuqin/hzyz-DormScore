// 服务端输入校验（前后端双重校验的后端部分）
import type { BedItem, Period, PublicItem, UserStatus } from '@dorm/contracts';
import { isValidDateString } from '../../shared/date';
import { err, ok, type Result } from '../../shared/result';
import { isNonNegativeInteger, isRecord } from '../../shared/utils';
import {
  BED_ITEMS,
  BED_POOL_POINTS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PERIODS,
  PUBLIC_ITEMS,
} from './constants';
import type { AppConfig, InspectionInput, UserRow } from './model';
import { normalizeBeds, poolKey } from './rules';

const USER_STATUSES: UserStatus[] = ['NORMAL', 'LEAVE'];

/** 校验并规范化「创建/更新每日记录」输入 */
export function validateInspectionInput(
  body: unknown,
  config: AppConfig,
  today: string,
): Result<InspectionInput> {
  if (!isRecord(body)) return err('INVALID_BODY', '请求体格式错误');

  const date = body.date;
  if (typeof date !== 'string' || !isValidDateString(date)) {
    return err('INVALID_DATE', '日期格式不正确');
  }
  if (date > today) return err('DATE_IN_FUTURE', '不能录入未来日期');

  const dutyUserId = body.dutyUserId;
  if (!isNonNegativeInteger(dutyUserId)) return err('INVALID_DUTY_USER', '值日生不正确');
  if (!config.users.some((u) => u.id === dutyUserId)) {
    return err('INVALID_DUTY_USER', '值日生不存在');
  }

  const talkAm = body.talkAm;
  const talkPm = body.talkPm;
  if (!isNonNegativeInteger(talkAm) || !isNonNegativeInteger(talkPm)) {
    return err('INVALID_TALK_COUNT', '讲话次数必须是非负整数');
  }

  const rawStatus = body.userStatus;
  if (!Array.isArray(rawStatus) || rawStatus.length !== config.users.length) {
    return err('INVALID_USER_STATUS', '必须填写全部成员当天状态');
  }
  const statusById = new Map<number, UserStatus>();
  for (const s of rawStatus) {
    if (
      !isRecord(s) ||
      !isNonNegativeInteger(s.userId) ||
      !USER_STATUSES.includes(s.status as UserStatus)
    ) {
      return err('INVALID_USER_STATUS', '成员状态数据不正确');
    }
    if (statusById.has(s.userId)) return err('INVALID_USER_STATUS', '成员状态重复');
    statusById.set(s.userId, s.status as UserStatus);
  }
  for (const u of config.users) {
    if (!statusById.has(u.id)) return err('INVALID_USER_STATUS', '缺少成员状态');
  }
  if (statusById.get(dutyUserId) !== 'NORMAL') {
    return err('DUTY_USER_ON_LEAVE', '请假人员不能担任值日生');
  }

  const rawBed = body.bedChecks;
  if (!Array.isArray(rawBed)) return err('INVALID_BED_CHECK', '床位检查数据格式错误');
  const bedPools: InspectionInput['bedChecks'] = [];
  const poolSeen = new Set<string>();
  for (const c of rawBed) {
    if (
      !isRecord(c) ||
      !PERIODS.includes(c.period as Period) ||
      !BED_ITEMS.includes(c.item as BedItem) ||
      !Array.isArray(c.beds) ||
      c.beds.length === 0
    ) {
      return err('INVALID_BED_CHECK', '床位检查数据不正确');
    }
    const key = poolKey(c.period as Period, c.item as BedItem);
    if (poolSeen.has(key)) return err('INVALID_BED_CHECK', '同一时段同一区域的扣分池只能提交一个');
    poolSeen.add(key);

    const beds: number[] = [];
    for (const bedId of c.beds) {
      if (!isNonNegativeInteger(bedId) || !config.beds.some((b) => b.id === bedId)) {
        return err('INVALID_BED_CHECK', '床位不存在');
      }
      beds.push(bedId);
    }
    bedPools.push({
      period: c.period as Period,
      item: c.item as BedItem,
      beds: normalizeBeds(beds),
      // 提交时按当前规则快照扣分，历史不随后续常量变化而重算
      deduction: BED_POOL_POINTS,
    });
  }

  const rawPublic = body.publicChecks;
  if (!Array.isArray(rawPublic)) return err('INVALID_PUBLIC_CHECK', '公共区域检查数据格式错误');
  const publicChecks: InspectionInput['publicChecks'] = [];
  const publicSeen = new Set<string>();
  for (const c of rawPublic) {
    if (
      !isRecord(c) ||
      !PERIODS.includes(c.period as Period) ||
      !(PUBLIC_ITEMS as readonly string[]).includes(c.item as string)
    ) {
      return err('INVALID_PUBLIC_CHECK', '公共区域检查数据不正确');
    }
    const key = `${c.period as string}:${c.item as string}`;
    if (publicSeen.has(key)) return err('INVALID_PUBLIC_CHECK', '公共区域检查项重复');
    publicSeen.add(key);
    publicChecks.push({ period: c.period as Period, item: c.item as PublicItem });
  }

  return ok({
    date,
    dutyUserId,
    talkAm,
    talkPm,
    userStatus: config.users.map((u) => ({ userId: u.id, status: statusById.get(u.id)! })),
    bedChecks: bedPools,
    publicChecks,
  });
}

/** 校验成员姓名 / 床位映射（不改床位结构本身） */
export function validateMembersInput(
  body: unknown,
  config: AppConfig,
): Result<{ users: UserRow[] }> {
  if (!isRecord(body) || !Array.isArray(body.users)) return err('INVALID_BODY', '请求体格式错误');
  const arr = body.users;
  if (arr.length !== config.users.length) {
    return err('INVALID_MEMBERS', `成员数量必须为 ${config.users.length} 人`);
  }
  const byId = new Map(config.users.map((u) => [u.id, u]));
  const seen = new Set<number>();
  const users: UserRow[] = [];
  for (const item of arr) {
    if (!isRecord(item)) return err('INVALID_MEMBERS', '成员数据格式错误');
    const { id, name, bedId, position } = item;
    if (!isNonNegativeInteger(id) || !byId.has(id)) return err('INVALID_MEMBERS', '成员不存在');
    if (seen.has(id)) return err('INVALID_MEMBERS', '成员重复');
    seen.add(id);
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 20) {
      return err('INVALID_MEMBERS', '姓名不能为空且不超过 20 字');
    }
    const bed = config.beds.find((b) => b.id === bedId);
    if (!isNonNegativeInteger(bedId) || !bed) return err('INVALID_MEMBERS', '床位不存在');
    const validPosition =
      bed.type === 'double' ? position === 'upper' || position === 'lower' : position === 'single';
    if (!validPosition) return err('INVALID_MEMBERS', '铺位与床位类型不匹配');
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
      const valid =
        occupants.length === 2 &&
        occupants.some((u) => u.position === 'upper') &&
        occupants.some((u) => u.position === 'lower');
      if (!valid) return err('INVALID_MEMBERS', `${bed.name} 必须有一名上铺和一名下铺成员`);
    } else if (occupants.length !== 1 || occupants[0]!.position !== 'single') {
      return err('INVALID_MEMBERS', `${bed.name} 必须有一名单人床成员`);
    }
  }
  return ok({ users });
}

/** 校验修改密码输入 */
export function validatePasswordChangeInput(body: unknown): Result<{
  currentAdminPassword: string;
  viewerPassword?: string;
  adminPassword?: string;
}> {
  if (!isRecord(body)) return err('INVALID_BODY', '请求体格式错误');
  const current = body.currentAdminPassword;
  if (typeof current !== 'string' || current.length === 0) {
    return err('INVALID_CURRENT_PASSWORD', '请输入当前管理密码');
  }
  const viewerPassword = body.viewerPassword;
  const adminPassword = body.adminPassword;
  if (viewerPassword === undefined && adminPassword === undefined) {
    return err('INVALID_BODY', '至少需要修改一个密码');
  }
  for (const p of [viewerPassword, adminPassword]) {
    if (p === undefined) continue;
    if (typeof p !== 'string' || p.length < PASSWORD_MIN_LENGTH || p.length > PASSWORD_MAX_LENGTH) {
      return err(
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
  return ok(value);
}
