// 输入校验测试
import { describe, expect, it } from 'vitest';
import {
  validateInspectionInput,
  validateMembersInput,
  validatePasswordChangeInput,
} from '../src/validation';
import { CONFIG, allNormal } from './fixtures';

const TODAY = '2026-08-16';

function validBody() {
  return {
    date: '2026-08-16',
    dutyUserId: 3,
    talkAm: 1,
    talkPm: 0,
    userStatus: allNormal(),
    bedChecks: [{ period: 'AM', bedId: 1, item: 'BED' }],
    publicChecks: [{ period: 'AM', item: 'TRASH' }],
  };
}

describe('validateInspectionInput', () => {
  it('合法输入通过', () => {
    const r = validateInspectionInput(validBody(), CONFIG, TODAY);
    expect(r.ok).toBe(true);
  });

  it('未来日期被拒绝（1.md 确认 #12）', () => {
    const r = validateInspectionInput({ ...validBody(), date: '2026-08-17' }, CONFIG, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DATE_IN_FUTURE');
  });

  it('日期格式错误', () => {
    const r = validateInspectionInput({ ...validBody(), date: '2026-8-16' }, CONFIG, TODAY);
    expect(r.ok).toBe(false);
  });

  it('请假人员不能担任值日生', () => {
    const userStatus = allNormal().map((s) =>
      s.userId === 3 ? { ...s, status: 'LEAVE' as const } : s,
    );
    const r = validateInspectionInput({ ...validBody(), userStatus }, CONFIG, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('DUTY_USER_ON_LEAVE');
  });

  it('缺少成员状态被拒绝', () => {
    const r = validateInspectionInput(
      { ...validBody(), userStatus: allNormal().slice(0, 6) },
      CONFIG,
      TODAY,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('INVALID_USER_STATUS');
  });

  it('讲话次数必须是非负整数', () => {
    for (const talkAm of [-1, 1.5, '2']) {
      const r = validateInspectionInput({ ...validBody(), talkAm }, CONFIG, TODAY);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('INVALID_TALK_COUNT');
    }
  });

  it('重复勾选与非法枚举被拒绝', () => {
    const dup = validateInspectionInput(
      {
        ...validBody(),
        bedChecks: [
          { period: 'AM', bedId: 1, item: 'BED' },
          { period: 'AM', bedId: 1, item: 'BED' },
        ],
      },
      CONFIG,
      TODAY,
    );
    expect(dup.ok).toBe(false);
    const badItem = validateInspectionInput(
      { ...validBody(), bedChecks: [{ period: 'AM', bedId: 1, item: 'DESK' }] },
      CONFIG,
      TODAY,
    );
    expect(badItem.ok).toBe(false);
    const badPeriod = validateInspectionInput(
      { ...validBody(), publicChecks: [{ period: 'NOON', item: 'TRASH' }] },
      CONFIG,
      TODAY,
    );
    expect(badPeriod.ok).toBe(false);
  });
});

describe('validateMembersInput', () => {
  function membersBody(overrides: Record<string, unknown> = {}) {
    return {
      users: CONFIG.users.map((u) => ({
        id: u.id,
        name: u.name,
        bedId: u.bedId,
        position: u.position,
        ...overrides,
      })),
    };
  }

  it('改名合法', () => {
    const body = membersBody();
    (body.users as { name: string }[])[0]!.name = '张三';
    const r = validateMembersInput(body, CONFIG);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.users[0]!.name).toBe('张三');
  });

  it('铺位与床位类型不匹配被拒绝', () => {
    const body = membersBody({ position: 'single' });
    const r = validateMembersInput(body, CONFIG);
    expect(r.ok).toBe(false);
  });

  it('上下铺必须恰好一上一下', () => {
    const body = {
      users: CONFIG.users.map((u) => ({
        id: u.id,
        name: u.name,
        bedId: u.bedId === 1 ? 1 : u.bedId,
        position: u.bedId === 1 ? ('upper' as const) : u.position,
      })),
    };
    const r = validateMembersInput(body, CONFIG);
    expect(r.ok).toBe(false);
  });

  it('成员数量与姓名长度校验', () => {
    expect(validateMembersInput({ users: membersBody().users.slice(0, 6) }, CONFIG).ok).toBe(false);
    const body = membersBody();
    (body.users as { name: string }[])[0]!.name = 'x'.repeat(21);
    expect(validateMembersInput(body, CONFIG).ok).toBe(false);
  });
});

describe('validatePasswordChangeInput', () => {
  it('合法：修改展示密码', () => {
    const r = validatePasswordChangeInput({
      currentAdminPassword: 'admin',
      viewerPassword: 'abcd1234',
    });
    expect(r.ok).toBe(true);
  });
  it('缺当前密码 / 无目标 / 密码过短均被拒绝', () => {
    expect(validatePasswordChangeInput({ viewerPassword: 'abcd' }).ok).toBe(false);
    expect(validatePasswordChangeInput({ currentAdminPassword: 'admin' }).ok).toBe(false);
    expect(
      validatePasswordChangeInput({ currentAdminPassword: 'admin', adminPassword: 'ab' }).ok,
    ).toBe(false);
  });
});
