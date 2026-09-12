// API 集成测试：登录/角色隔离/录入/修改/撤回/恢复/日志/密码/配置 全流程
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app/createApp';
import { resetLoginAttemptsForTest } from '../src/auth/rate-limit';
import { monthKeyOf, todayInShanghai } from '../src/shared/date';
import type { Env } from '../src/app/context';
import { CONFIG, allNormal } from './fixtures';
import { MemStore } from './mem-store';

const env = {} as Env;

function makeApp() {
  const store = new MemStore();
  const app = createApp(() => store);
  return { app, store };
}

function cookieOf(res: Response): string {
  return res.headers.get('set-cookie')?.split(';')[0] ?? '';
}

async function login(
  app: ReturnType<typeof makeApp>['app'],
  role: 'VIEWER' | 'ADMIN',
  password = 'admin',
  ip = 'test-ip',
): Promise<Response> {
  return app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
      body: JSON.stringify({ role, password }),
    },
    env,
  );
}

async function requestAsAdmin(
  app: ReturnType<typeof makeApp>['app'],
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const cookie = cookieOf(await login(app, 'ADMIN', 'admin', 'admin-ip'));
  return app.request(
    path,
    {
      method,
      headers: { 'content-type': 'application/json', cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
}

/** 扣分池示例：床位池 4 + 公共 3 + 讲话 2 → 总扣 9，得分 11 */
function sampleBody(date: string) {
  return {
    date,
    dutyUserId: 3,
    talkAm: 1,
    talkPm: 0,
    userStatus: allNormal(),
    bedChecks: [
      { period: 'AM', item: 'BED', beds: [1] },
      { period: 'PM', item: 'BED', beds: [1, 2] },
    ],
    publicChecks: [
      { period: 'AM', item: 'TRASH' },
      { period: 'PM', item: 'TOILET' },
      { period: 'PM', item: 'TABLE' },
    ],
  };
}

beforeEach(() => resetLoginAttemptsForTest());

describe('认证与会话', () => {
  it('未登录访问任何接口 → 401', async () => {
    const { app } = makeApp();
    const res = await app.request('/api/stats/overview', {}, env);
    expect(res.status).toBe(401);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });

  it('展示/管理分别登录，me 返回对应角色', async () => {
    const { app } = makeApp();
    const viewerCookie = cookieOf(await login(app, 'VIEWER', 'admin', 'v-ip'));
    const viewerMe = await app.request('/api/auth/me', { headers: { cookie: viewerCookie } }, env);
    expect(((await viewerMe.json()) as { data: { role: string } }).data.role).toBe('VIEWER');

    const adminMe = await app.request(
      '/api/auth/me',
      { headers: { cookie: cookieOf(await login(app, 'ADMIN', 'admin', 'a-ip')) } },
      env,
    );
    expect(((await adminMe.json()) as { data: { role: string } }).data.role).toBe('ADMIN');
  });

  it('密码错误 → 401；5 次失败后锁定 429（即使密码正确）', async () => {
    const { app } = makeApp();
    for (let i = 0; i < 5; i++) {
      expect((await login(app, 'ADMIN', 'wrong', 'lock-ip')).status).toBe(401);
    }
    expect((await login(app, 'ADMIN', 'admin', 'lock-ip')).status).toBe(429);
  });

  it('注销后 me 为 null', async () => {
    const { app } = makeApp();
    const cookie = cookieOf(await login(app, 'VIEWER', 'admin', 'lo-ip'));
    await app.request('/api/auth/logout', { method: 'POST', headers: { cookie } }, env);
    const me = await app.request('/api/auth/me', { headers: { cookie } }, env);
    expect(((await me.json()) as { data: { role: string | null } }).data.role).toBeNull();
  });
});

describe('角色隔离（1.md §39 核心要求）', () => {
  it('展示会话访问只读接口正常，访问任何写接口 → 403', async () => {
    const { app } = makeApp();
    const cookie = cookieOf(await login(app, 'VIEWER', 'admin', 'role-ip'));
    expect((await app.request('/api/stats/overview', { headers: { cookie } }, env)).status).toBe(
      200,
    );
    expect((await app.request('/api/config', { headers: { cookie } }, env)).status).toBe(200);

    const today = todayInShanghai();
    const forbidden = [
      ['POST', '/api/admin/inspections', sampleBody(today)],
      ['POST', '/api/admin/inspections/1/revoke', {}],
      ['PUT', '/api/admin/passwords', { currentAdminPassword: 'admin', adminPassword: 'newpass1' }],
      ['PUT', '/api/config/members', { users: CONFIG.users }],
      ['GET', '/api/admin/audit-logs', undefined],
      ['GET', '/api/admin/inspections', undefined],
    ] as const;
    for (const [method, path, body] of forbidden) {
      const res = await app.request(
        path,
        {
          method,
          headers: { 'content-type': 'application/json', cookie },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        env,
      );
      expect(res.status, `${method} ${path} 应被拒绝`).toBe(403);
    }
  });
});

describe('★ 扣分池业务语义（API 层）', () => {
  it('AM FLOOR 命中 1、3 床 → 宿舍扣 2 分，个人各 0.5', async () => {
    const { app } = makeApp();
    const today = todayInShanghai();
    const res = await requestAsAdmin(app, 'POST', '/api/admin/inspections', {
      date: today,
      dutyUserId: 3,
      talkAm: 0,
      talkPm: 0,
      userStatus: allNormal(),
      bedChecks: [{ period: 'AM', item: 'FLOOR', beds: [1, 3] }],
      publicChecks: [],
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      data: { record: { totalDeduction: number; score: number; bedChecks: unknown[] } };
    };
    expect(data.data.record.totalDeduction).toBe(2);
    expect(data.data.record.score).toBe(18);
    expect(data.data.record.bedChecks).toEqual([
      {
        period: 'AM',
        item: 'FLOOR',
        itemLabel: '床下地面',
        beds: [1, 3],
        bedNames: ['1床', '3床'],
        deduction: 2,
        responsibleUsers: [
          { userId: 1, name: 'User1', share: 0.5 },
          { userId: 2, name: 'User2', share: 0.5 },
          { userId: 5, name: 'User5', share: 0.5 },
          { userId: 6, name: 'User6', share: 0.5 },
        ],
      },
    ]);
  });

  it('四个池全命中 → 床位扣 8 分（而非 16）', async () => {
    const { app } = makeApp();
    const today = todayInShanghai();
    const res = await requestAsAdmin(app, 'POST', '/api/admin/inspections', {
      date: today,
      dutyUserId: 3,
      talkAm: 0,
      talkPm: 0,
      userStatus: allNormal(),
      bedChecks: [
        { period: 'AM', item: 'BED', beds: [1, 2, 3, 4] },
        { period: 'AM', item: 'FLOOR', beds: [1, 2, 3, 4] },
        { period: 'PM', item: 'BED', beds: [1, 2, 3, 4] },
        { period: 'PM', item: 'FLOOR', beds: [1, 2, 3, 4] },
      ],
      publicChecks: [],
    });
    const data = (await res.json()) as {
      data: { record: { bedDeduction: number; score: number } };
    };
    expect(data.data.record.bedDeduction).toBe(8);
    expect(data.data.record.score).toBe(12);
  });
});

describe('录入 / 更新 / 历史', () => {
  it('创建记录 → 概览/个人/频次/日历/单日/纪律 全部按规则计算', async () => {
    const { app, store } = makeApp();
    const today = todayInShanghai();
    const createRes = await requestAsAdmin(
      app,
      'POST',
      '/api/admin/inspections',
      sampleBody(today),
    );
    expect(createRes.status).toBe(200);
    const created = (await createRes.json()) as {
      data: { action: string; record: { score: number; totalDeduction: number } };
    };
    expect(created.data.action).toBe('created');
    expect(created.data.record.score).toBe(11);
    expect(created.data.record.totalDeduction).toBe(9);

    const viewerCookie = cookieOf(await login(app, 'VIEWER', 'admin', 'calc-ip'));
    const overview = await app.request(
      '/api/stats/overview',
      { headers: { cookie: viewerCookie } },
      env,
    );
    const overviewData = (
      (await overview.json()) as { data: { today: { score: number; bedDeduction: number } } }
    ).data;
    expect(overviewData.today.score).toBe(11);
    expect(overviewData.today.bedDeduction).toBe(4);

    // 个人：U1=1.5 U2=1.5 U3=3.5 U4=0.5
    const personal = await app.request(
      '/api/stats/personal?month=' + monthKeyOf(today),
      { headers: { cookie: viewerCookie } },
      env,
    );
    const personalData = (
      (await personal.json()) as {
        data: {
          users: {
            userId: number;
            deduction: number;
            bedDeduction: number;
            publicDeduction: number;
            dutyCount: number;
          }[];
        };
      }
    ).data;
    const byId = new Map(personalData.users.map((u) => [u.userId, u.deduction]));
    expect(byId.get(1)).toBe(1.5);
    expect(byId.get(2)).toBe(1.5);
    expect(byId.get(3)).toBe(3.5);
    expect(byId.get(4)).toBe(0.5);
    expect(byId.get(7)).toBe(0);

    const u3 = personalData.users.find((u) => u.userId === 3)!;
    expect(u3).toEqual({
      userId: 3,
      name: 'User3',
      deduction: 3.5,
      bedDeduction: 0.5,
      publicDeduction: 3,
      dutyCount: 1,
    });

    // 频次：一个池计一次 → 床面 2、垃圾桶 1、厕所 1、置物桌 1
    const freq = await app.request(
      '/api/stats/frequency?month=' + monthKeyOf(today),
      { headers: { cookie: viewerCookie } },
      env,
    );
    const freqData = ((await freq.json()) as { data: { items: { key: string; count: number }[] } })
      .data;
    const freqByKey = new Map(freqData.items.map((i) => [i.key, i.count]));
    expect(freqByKey.get('BED')).toBe(2);
    expect(freqByKey.get('TRASH')).toBe(1);
    expect(freqByKey.get('TOILET')).toBe(1);
    expect(freqByKey.get('TABLE')).toBe(1);

    // 日历：今天得分 11，无记录日期为 null
    const calendar = await app.request(
      '/api/stats/calendar?month=' + monthKeyOf(today),
      { headers: { cookie: viewerCookie } },
      env,
    );
    const calendarData = (
      (await calendar.json()) as {
        data: { days: { date: string; score: number | null }[]; months: string[] };
      }
    ).data;
    expect(calendarData.days.find((d) => d.date === today)?.score).toBe(11);
    expect(calendarData.days.some((d) => d.score === null)).toBe(true);
    expect(calendarData.months).toContain(monthKeyOf(today));

    // 单日明细：床位池含命中床位与责任分摊
    const dayDetail = await app.request(
      '/api/stats/day?date=' + today,
      { headers: { cookie: viewerCookie } },
      env,
    );
    const dayData = (
      (await dayDetail.json()) as {
        data: {
          score: number;
          dutyUserName: string;
          bedChecks: { beds: number[]; deduction: number }[];
          publicChecks: unknown[];
          userStatus: unknown[];
        } | null;
      }
    ).data;
    expect(dayData?.score).toBe(11);
    expect(dayData?.bedChecks).toHaveLength(2);
    expect(dayData?.bedChecks[1]!.beds).toEqual([1, 2]);
    expect(dayData?.publicChecks).toHaveLength(3);
    expect(dayData?.userStatus).toHaveLength(7);

    const noDay = await app.request(
      '/api/stats/day?date=2099-01-01',
      { headers: { cookie: viewerCookie } },
      env,
    );
    expect(((await noDay.json()) as { data: unknown }).data).toBeNull();
    const badDate = await app.request(
      '/api/stats/day?date=not-a-date',
      { headers: { cookie: viewerCookie } },
      env,
    );
    expect(badDate.status).toBe(400);

    // 纪律：只显示今天 1 次
    const discipline = await app.request(
      '/api/stats/discipline',
      { headers: { cookie: viewerCookie } },
      env,
    );
    const disciplineData = (
      (await discipline.json()) as { data: { records: { date: string; count: number }[] } }
    ).data;
    expect(disciplineData.records).toEqual([{ date: today, talkAm: 1, talkPm: 0, count: 1 }]);

    // 历史记录与日志
    const history = await requestAsAdmin(app, 'GET', '/api/admin/inspections');
    expect(((await history.json()) as { data: { records: unknown[] } }).data.records).toHaveLength(
      1,
    );
    const logs = await requestAsAdmin(app, 'GET', '/api/admin/audit-logs');
    const logsData = (
      (await logs.json()) as { data: { logs: { action: string }[]; total: number } }
    ).data;
    expect(logsData.total).toBe(1);
    expect(logsData.logs[0]!.action).toBe('CREATE');

    expect(await store.inspections.list()).toHaveLength(1);
  });

  it('同一天再次提交 → 更新而非新增', async () => {
    const { app, store } = makeApp();
    const today = todayInShanghai();
    await requestAsAdmin(app, 'POST', '/api/admin/inspections', sampleBody(today));
    const updateRes = await requestAsAdmin(app, 'POST', '/api/admin/inspections', {
      ...sampleBody(today),
      talkAm: 0,
    });
    const updated = (await updateRes.json()) as {
      data: { action: string; record: { totalDeduction: number } };
    };
    expect(updated.data.action).toBe('updated');
    expect(updated.data.record.totalDeduction).toBe(7);
    expect(await store.inspections.list()).toHaveLength(1);

    const logs = await requestAsAdmin(app, 'GET', '/api/admin/audit-logs');
    expect(
      ((await logs.json()) as { data: { logs: { action: string }[] } }).data.logs[0]!.action,
    ).toBe('UPDATE');
  });

  it('修改日期冲突 → 409；改为空闲日期成功', async () => {
    const { app } = makeApp();
    const d1 = todayInShanghai();
    const d2 = '2026-08-01';
    await requestAsAdmin(app, 'POST', '/api/admin/inspections', sampleBody(d1));
    const createB = await requestAsAdmin(app, 'POST', '/api/admin/inspections', sampleBody(d2));
    const idA = (
      (await (
        await requestAsAdmin(app, 'GET', '/api/admin/inspections/by-date?date=' + d1)
      ).json()) as { data: { record: { id: number } } }
    ).data.record.id;
    const idB = ((await createB.json()) as { data: { record: { id: number } } }).data.record.id;

    const conflict = await requestAsAdmin(app, 'POST', '/api/admin/inspections', {
      ...sampleBody(d1),
      id: idA,
      date: d2,
    });
    expect(conflict.status).toBe(409);
    const okRes = await requestAsAdmin(app, 'POST', '/api/admin/inspections', {
      ...sampleBody(d1),
      id: idB,
      date: '2026-08-02',
    });
    expect(okRes.status).toBe(200);
  });

  it('输入校验：未来日期 / 请假值日生 → 400', async () => {
    const { app } = makeApp();
    expect(
      (await requestAsAdmin(app, 'POST', '/api/admin/inspections', sampleBody('2099-01-01')))
        .status,
    ).toBe(400);
    const dutyOnLeave = await requestAsAdmin(app, 'POST', '/api/admin/inspections', {
      ...sampleBody('2026-08-10'),
      userStatus: allNormal().map((s) => (s.userId === 3 ? { ...s, status: 'LEAVE' } : s)),
    });
    expect(dutyOnLeave.status).toBe(400);
  });
});

describe('撤回 / 恢复', () => {
  it('撤回后不参与统计；恢复后重新参与；全程留痕且幂等', async () => {
    const { app } = makeApp();
    const today = todayInShanghai();
    await requestAsAdmin(app, 'POST', '/api/admin/inspections', sampleBody(today));
    const byDate = await requestAsAdmin(app, 'GET', '/api/admin/inspections/by-date?date=' + today);
    const id = ((await byDate.json()) as { data: { record: { id: number } } }).data.record.id;

    const viewerCookie = cookieOf(await login(app, 'VIEWER', 'admin', 'rv-ip'));
    const revokeRes = await requestAsAdmin(app, 'POST', `/api/admin/inspections/${id}/revoke`, {
      reason: '录错了',
    });
    expect(revokeRes.status).toBe(200);
    const overviewAfterRevoke = await app.request(
      '/api/stats/overview',
      { headers: { cookie: viewerCookie } },
      env,
    );
    expect(
      ((await overviewAfterRevoke.json()) as { data: { today: unknown } }).data.today,
    ).toBeNull();

    const restoreRes = await requestAsAdmin(
      app,
      'POST',
      `/api/admin/inspections/${id}/restore`,
      {},
    );
    expect(restoreRes.status).toBe(200);
    const overviewAfterRestore = await app.request(
      '/api/stats/overview',
      { headers: { cookie: viewerCookie } },
      env,
    );
    expect(
      ((await overviewAfterRestore.json()) as { data: { today: { score: number } } }).data.today
        .score,
    ).toBe(11);

    await requestAsAdmin(app, 'POST', `/api/admin/inspections/${id}/revoke`, {});
    const again = await requestAsAdmin(app, 'POST', `/api/admin/inspections/${id}/revoke`, {});
    expect(((await again.json()) as { data: { action: string } }).data.action).toBe('unchanged');

    const logs = await requestAsAdmin(app, 'GET', '/api/admin/audit-logs');
    const logsData = (
      (await logs.json()) as { data: { logs: { action: string; reason: string | null }[] } }
    ).data;
    expect(logsData.logs.map((l) => l.action)).toEqual(['REVOKE', 'RESTORE', 'REVOKE', 'CREATE']);
    expect(logsData.logs[2]!.reason).toBe('录错了');
  });
});

describe('密码与配置', () => {
  it('修改密码：错误当前密码 401；成功后新密码生效、旧密码失效', async () => {
    const { app } = makeApp();
    expect(
      (
        await requestAsAdmin(app, 'PUT', '/api/admin/passwords', {
          currentAdminPassword: 'bad',
          adminPassword: 'new-pass-123',
        })
      ).status,
    ).toBe(401);
    const okRes = await requestAsAdmin(app, 'PUT', '/api/admin/passwords', {
      currentAdminPassword: 'admin',
      viewerPassword: 'view-123',
      adminPassword: 'new-pass-123',
    });
    expect(okRes.status).toBe(200);
    expect((await login(app, 'ADMIN', 'admin', 'pw-old')).status).toBe(401);
    expect((await login(app, 'ADMIN', 'new-pass-123', 'pw-new')).status).toBe(200);
    expect((await login(app, 'VIEWER', 'view-123', 'pw-v')).status).toBe(200);
  });

  it('修改成员姓名：校验 + 审计', async () => {
    const { app } = makeApp();
    const users = CONFIG.users.map((u) => ({
      id: u.id,
      name: u.id === 1 ? '张三' : u.name,
      bedId: u.bedId,
      position: u.position,
    }));
    const okRes = await requestAsAdmin(app, 'PUT', '/api/config/members', { users });
    expect(okRes.status).toBe(200);
    expect(
      ((await okRes.json()) as { data: { users: { name: string }[] } }).data.users[0]!.name,
    ).toBe('张三');

    const bad = await requestAsAdmin(app, 'PUT', '/api/config/members', {
      users: CONFIG.users.map((u, i) => ({
        id: u.id,
        name: u.name,
        bedId: u.bedId,
        position: i === 0 ? 'single' : u.position,
      })),
    });
    expect(bad.status).toBe(400);
  });
});

describe('CSRF 防护', () => {
  it('跨源写请求被拒绝；本机开发豁免', async () => {
    const { app } = makeApp();
    const cookie = cookieOf(await login(app, 'ADMIN', 'admin', 'csrf-ip'));
    const res = await app.request(
      'http://dorm-score.workers.dev/api/admin/inspections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: 'https://evil.example.com' },
        body: JSON.stringify(sampleBody('2026-08-10')),
      },
      env,
    );
    expect(res.status).toBe(403);

    const local = await app.request(
      '/api/admin/inspections',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: 'http://localhost:5173' },
        body: JSON.stringify(sampleBody('2026-08-10')),
      },
      env,
    );
    expect(local.status).toBe(200);
  });
});
