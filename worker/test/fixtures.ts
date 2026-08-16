// 测试夹具：标准床位/成员配置、记录构造器
import type { AppConfig, InspectionRecord, UserStatusEntry } from '../src/types';
import { INITIAL_PASSWORD_HASH } from '../src/constants';

export const CONFIG: AppConfig = {
  beds: [
    { id: 1, name: '1床', type: 'double', sort: 1 },
    { id: 2, name: '2床', type: 'double', sort: 2 },
    { id: 3, name: '3床', type: 'double', sort: 3 },
    { id: 4, name: '4床', type: 'single', sort: 4 },
  ],
  users: [
    { id: 1, name: 'User1', bedId: 1, position: 'upper', sort: 1 },
    { id: 2, name: 'User2', bedId: 1, position: 'lower', sort: 2 },
    { id: 3, name: 'User3', bedId: 2, position: 'upper', sort: 3 },
    { id: 4, name: 'User4', bedId: 2, position: 'lower', sort: 4 },
    { id: 5, name: 'User5', bedId: 3, position: 'upper', sort: 5 },
    { id: 6, name: 'User6', bedId: 3, position: 'lower', sort: 6 },
    { id: 7, name: 'User7', bedId: 4, position: 'single', sort: 7 },
  ],
};

/** 全员正常状态 */
export function allNormal(): UserStatusEntry[] {
  return CONFIG.users.map((u) => ({ userId: u.id, status: 'NORMAL' as const }));
}

let nextRecordId = 1;
export function makeRecord(overrides: Partial<InspectionRecord> = {}): InspectionRecord {
  return {
    id: nextRecordId++,
    date: '2026-08-10',
    dutyUserId: 3,
    talkAm: 0,
    talkPm: 0,
    status: 'ACTIVE',
    createdAt: '2026-08-10T08:00:00.000Z',
    updatedAt: '2026-08-10T08:00:00.000Z',
    userStatus: allNormal(),
    bedChecks: [],
    publicChecks: [],
    ...overrides,
  };
}

export const SEED_HASH = INITIAL_PASSWORD_HASH;
