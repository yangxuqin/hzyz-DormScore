# API 接口契约

> 后端：Cloudflare Workers（`worker/`），共享类型：`packages/contracts`。
> 前端（`web/`）必须严格按本文档对接。
> 所有响应均为 JSON；除登录外均需携带会话 Cookie（`fetch` 使用 `credentials: 'include'`）。

## 1. 通用约定

### 1.1 响应包装

```ts
// 成功
{ "ok": true, "data": ... }
// 失败（HTTP 400/401/403/404/409/429/500 等）
{ "ok": false, "error": { "code": string, "message": string } }
```

### 1.2 错误码

| code                                                                                  | HTTP | 含义                            |
| ------------------------------------------------------------------------------------- | ---- | ------------------------------- |
| UNAUTHORIZED                                                                          | 401  | 未登录/会话过期（前端跳登录）   |
| FORBIDDEN                                                                             | 403  | 权限不足（展示会话调写接口）    |
| CSRF_REJECTED                                                                         | 403  | 跨源请求被拒绝                  |
| NOT_FOUND                                                                             | 404  | 资源/接口不存在                 |
| DATE_CONFLICT                                                                         | 409  | 改日期时目标日期已有记录        |
| RATE_LIMITED                                                                          | 429  | 登录尝试过多被锁定              |
| INVALID_BODY / INVALID_DATE / DATE_IN_FUTURE / INVALID_DUTY_USER / DUTY_USER_ON_LEAVE | 400  | 录入校验失败                    |
| INVALID_USER_STATUS / INVALID_BED_CHECK / INVALID_PUBLIC_CHECK / INVALID_TALK_COUNT   | 400  | 录入数据校验失败                |
| INVALID_ID / INVALID_RANGE / INVALID_MONTH                                            | 400  | 参数错误                        |
| INVALID_CURRENT_PASSWORD / INVALID_PASSWORD                                           | 401  | 改密：当前密码错误/新密码不合规 |
| INVALID_MEMBERS                                                                       | 400  | 成员配置校验失败                |
| NOT_INITIALIZED / INTERNAL                                                            | 500  | 未初始化/内部错误               |

### 1.3 枚举与常量

```ts
type Period = 'AM' | 'PM'; // 上午 / 下午
type UserStatus = 'NORMAL' | 'LEAVE';
type BedItem = 'BED' | 'FLOOR'; // 床面 / 床下地面
type PublicItem = 'TRASH' | 'BALCONY' | 'INDOOR' | 'TOILET' | 'SINK' | 'TABLE';
type InspectionStatus = 'ACTIVE' | 'REVOKED';
```

**★ 扣分规则（扣分池模型）**

- 一个扣分池 = `period × item`，固定扣 **2 分**（与命中床位数量无关）；全天床位最多 8 分。
- 公共区域按 `period × item` 计，每项 **1 分**。
- 讲话 **2 分/次**（宿舍级，不计个人）。
- 每日总扣分 = 床位 + 公共 + 纪律；每日得分 = `max(0, 20 - 总扣分)`。

---

## 2. 认证

### POST /api/auth/login

```ts
// 请求
{ role: 'VIEWER' | 'ADMIN', password: string }
// 200：设置 HttpOnly Cookie，返回
{ ok: true, data: { role: 'VIEWER' | 'ADMIN' } }
// 401 INVALID_PASSWORD / 429 RATE_LIMITED
```

### POST /api/auth/logout → `{ ok: true, data: null }`

### GET /api/auth/me → `{ ok: true, data: { role: 'VIEWER' | 'ADMIN' | null } }`

---

## 3. 基础配置

### GET /api/config（任意会话）

```ts
{ ok: true, data: {
  beds:  [{ id, name, type: 'double'|'single', sort }],
  users: [{ id, name, bedId, position: 'upper'|'lower'|'single', sort }],
} }
```

### PUT /api/config/members（仅 ADMIN）

```ts
// 请求：完整成员列表（id 不变，可改 name/bedId/position）
{
  users: [{ id, name, bedId, position }];
}
// 校验：姓名 1-20 字；上下铺恰好一上一下；单人床恰好一人
// 200：<同 GET /api/config>
```

---

## 4. 展示接口（VIEWER 只读）

### GET /api/stats/overview

```ts
{ ok: true, data: {
  // 今日无有效记录 → null（前端显示 "-"）
  today: EnrichedRecord | null,
  weekRate:  { label, rate, days, fullScoreDays } | null,
  monthRate: { label, rate, days, fullScoreDays } | null,
} }
```

### GET /api/stats/trend/daily

```ts
{ ok: true, data: { points: [{
  date, score,
  totalDeduction, bedDeduction, publicDeduction, disciplineDeduction, talkCount,
}] } } // 仅有效日，按日期升序
```

### GET /api/stats/trend/weekly

```ts
{ ok: true, data: { points: [{ key /* 周一日期 */, label /* 08/10-08/16 */, rate, days }] } }
```

### GET /api/stats/trend/monthly

```ts
{ ok: true, data: { points: [{ key /* 2026-08 */, label, rate, days }] } }
```

### GET /api/stats/calendar?month=YYYY-MM

```ts
{ ok: true, data: {
  selectedMonth: string,
  months: string[],                      // 升序（有记录月份 ∪ 当前月）
  days: [{ date, weekday /* 1=周一…7=周日 */, score: number | null }],
} }
```

### GET /api/stats/day?date=YYYY-MM-DD

```ts
{ ok: true, data: EnrichedRecord | null }
// 无有效记录（含 REVOKED）→ null；格式非法 → 400 INVALID_DATE
```

### GET /api/stats/personal?month=YYYY-MM

```ts
{ ok: true, data: {
  selectedMonth: string | null,
  months: string[],
  users: [{ userId, name, deduction, bedDeduction, publicDeduction, dutyCount }],
  // deduction 允许小数（个人分摊）
} }
```

### GET /api/stats/frequency?month=YYYY-MM

```ts
{ ok: true, data: {
  selectedMonth: string | null,
  months: string[],
  items: [{ key, label, count }], // 固定 8 项
} }
```

### GET /api/stats/discipline

```ts
{ ok: true, data: { records: [{ date, talkAm, talkPm, count }] } } // count>0，日期倒序
```

---

## 5. 管理接口（全部 ADMIN）

### GET /api/admin/inspections?from=&to=

```ts
{ ok: true, data: { records: [EnrichedRecord] } } // 日期升序
```

### GET /api/admin/inspections/by-date?date=YYYY-MM-DD

```ts
{ ok: true, data: { record: EnrichedRecord | null } }
```

### POST /api/admin/inspections —— 创建或更新（一天一条）

```ts
// 请求
{
  id?: number,        // 更新已有记录时携带（改日期必需）；省略则按 date 查找
  date: string,       // ≤ 今天（Asia/Shanghai）
  dutyUserId: number, // 当天状态必须 NORMAL
  talkAm: number, talkPm: number,            // 非负整数
  userStatus: [{ userId, status }],          // 全部成员完整
  bedChecks: [{ period, item, beds: number[] }], // ★ 扣分池：同时段同区域只能一个，beds 非空
  publicChecks: [{ period, item }],
  reason?: string,
}
// 200
{ ok: true, data: { record: EnrichedRecord, action: 'created' | 'updated' | 'unchanged' } }
// 409 DATE_CONFLICT；400 各类校验失败
```

> 注意：`bedChecks` 是**池**数组，不是逐床数组。例如上午 1、3 床床下出问题应提交
> `{ period: 'AM', item: 'FLOOR', beds: [1, 3] }`。

### POST /api/admin/inspections/:id/revoke（可带 `{ reason }`）

### POST /api/admin/inspections/:id/restore（可带 `{ reason }`）

```ts
{ ok: true, data: { record: EnrichedRecord, action: 'updated' | 'unchanged' } }
// unchanged = 重复操作（幂等，不重复记日志）
```

### GET /api/admin/audit-logs?limit=50&offset=0

```ts
{ ok: true, data: { total, logs: [{ id, operator, action, target, beforeJson, afterJson, reason, createdAt }] } }
// limit 最大 100，按 id 倒序
```

### PUT /api/admin/passwords

```ts
{ currentAdminPassword: string, viewerPassword?: string, adminPassword?: string }
// 至少修改一个；新密码 4-64 位；200 → { ok: true, data: null }；401 INVALID_CURRENT_PASSWORD
```

---

## 6. EnrichedRecord（记录输出结构）

```ts
{
  id: number,
  date: string, weekday: string,             // 如 "星期日"
  dutyUserId: number, dutyUserName: string,
  status: 'ACTIVE' | 'REVOKED',
  talkAm: number, talkPm: number,
  userStatus: [{ userId, userName, status }],
  // ★ 床位扣分池（最多 4 个）
  bedChecks: [{
    period: Period, item: BedItem, itemLabel: string, // "床面" / "床下地面"
    beds: number[],                                   // 命中床位 id（升序）
    bedNames: string[],                               // ["1床", "3床"]
    deduction: number,                                // 该池扣分（快照）
    responsibleUsers: [{ userId, name, share }],      // 责任人及人均分摊（排除请假）
  }],
  publicChecks: [{ period, item, itemLabel }],
  bedDeduction: number,       // = Σ 各池 deduction
  publicDeduction: number,
  disciplineDeduction: number, talkCount: number,
  totalDeduction: number, score: number,
  createdAt: string, updatedAt: string,
}
```

> 前端**不得**自行推断责任分摊与扣分，一律使用后端返回字段。

---

## 7. 前端对接要点

1. 所有请求 `credentials: 'include'`；收到 401 + `UNAUTHORIZED` 时由**全局唯一**处理器清会话并跳登录页。
2. 会话在应用启动时通过 `GET /auth/me` 确认一次，路由守卫读取缓存角色，避免循环重定向。
3. 录入页实时统计由前端按扣分池规则本地计算（与后端一致），仅作预览，以提交后返回为准。
4. 月份切换器使用接口返回的 `months`，默认 `selectedMonth`。
5. 修改历史记录时携带 `id`；改日期可能返回 409 `DATE_CONFLICT`，需提示用户。
