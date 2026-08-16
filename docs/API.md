# API 接口契约

> 后端：Cloudflare Workers（worker/），前端（web/）必须严格按本文档对接。
> 所有响应均为 JSON；除登录外均需携带会话 Cookie（登录时由服务端下发，前端 fetch 使用 `credentials: 'include'`）。

## 1. 通用约定

### 1.1 响应包装

```ts
// 成功
{ "ok": true, "data": ... }
// 失败（HTTP 状态码 400/401/403/404/409/429/500 等）
{ "ok": false, "error": { "code": string, "message": string } }
```

### 1.2 错误码

| code | 含义 |
|---|---|
| UNAUTHORIZED | 未登录或会话过期（前端收到后跳转登录页） |
| FORBIDDEN | 会话权限不足（展示会话调用管理接口） |
| CSRF_REJECTED | 跨源请求被拒绝 |
| INVALID_BODY | 请求体格式错误 |
| INVALID_PASSWORD | 登录密码错误 |
| RATE_LIMITED | 登录尝试次数过多，已被锁定 |
| NOT_INITIALIZED | 密码未初始化 |
| NOT_FOUND | 资源不存在 / 接口不存在 |
| INVALID_DATE / DATE_IN_FUTURE | 日期格式错误 / 未来日期 |
| INVALID_DUTY_USER / DUTY_USER_ON_LEAVE | 值日生无效 / 请假人员当值日生 |
| INVALID_USER_STATUS / INVALID_BED_CHECK / INVALID_PUBLIC_CHECK / INVALID_TALK_COUNT | 录入数据校验失败 |
| DATE_CONFLICT | 修改日期时目标日期已有另一条记录 |
| INVALID_ID / INVALID_RANGE / INVALID_MONTH | 参数错误 |
| INVALID_CURRENT_PASSWORD / INVALID_PASSWORD | 改密码时当前密码错误 / 新密码不合规 |
| INVALID_MEMBERS | 成员配置校验失败 |
| INTERNAL | 服务器内部错误 |

### 1.3 枚举与常量

```ts
type Period = 'AM' | 'PM';                    // 上午 / 下午
type UserStatus = 'NORMAL' | 'LEAVE';         // 正常 / 请假
type BedItem = 'BED' | 'FLOOR';               // 床面 / 床下地面
type PublicItem = 'TRASH' | 'BALCONY' | 'INDOOR' | 'TOILET' | 'SINK' | 'TABLE';
// 垃圾桶 / 阳台地面 / 室内地面 / 厕所 / 洗衣槽 / 置物桌
type InspectionStatus = 'ACTIVE' | 'REVOKED';

// 扣分规则（前端录入页实时统计用）：
// 床位项目 2 分/项，公共项目 1 分/项，讲话 2 分/次
// 每日总扣分 = 床位 + 公共 + 讲话；每日得分 = max(0, 20 - 总扣分)
```

---

## 2. 认证

### POST /api/auth/login
```ts
// 请求
{ role: 'VIEWER' | 'ADMIN', password: string }
// 成功 200：设置 HttpOnly Cookie（长期会话），返回
{ ok: true, data: { role: 'VIEWER' | 'ADMIN' } }
// 失败 401 / 429（锁定）
```

### POST /api/auth/logout
```ts
// 200
{ ok: true, data: null }
```

### GET /api/auth/me
```ts
// 200（未登录也返回 200，role 为 null）
{ ok: true, data: { role: 'VIEWER' | 'ADMIN' | null } }
```

---

## 3. 基础配置

### GET /api/config（任意会话）
```ts
{ ok: true, data: {
  beds: [{ id: number, name: string, type: 'double' | 'single', sort: number }],
  users: [{ id: number, name: string, bedId: number, position: 'upper' | 'lower' | 'single', sort: number }],
} }
```

### PUT /api/config/members（仅 ADMIN）
```ts
// 请求：7 人完整列表（id 不变，可改 name/bedId/position）
{ users: [{ id, name, bedId, position }] }
// 校验：姓名 1-20 字；上下铺床恰好一上一下；单人床恰好一人
// 成功 200：{ ok: true, data: <同 GET /api/config> }
```

---

## 4. 展示接口（VIEWER 只读）

### GET /api/stats/overview
```ts
{ ok: true, data: {
  // 今日无有效记录 → null（前端显示 "-"）
  today: {
    date: string,            // YYYY-MM-DD
    bedDeduction: number,    // 床位扣分
    publicDeduction: number, // 公共区域扣分
    disciplineDeduction: number, // 纪律扣分
    talkCount: number,       // 讲话总次数
    totalDeduction: number,  // 总扣分
    score: number,           // 今日得分（0-20）
  } | null,
  // 本周无有效日 → null
  weekRate: { label: string /* 08/10-08/16 */, rate: number /* 88.75 */, days: number } | null,
  // 本月无有效日 → null
  monthRate: { label: string /* 2026-08 */, rate: number, days: number } | null,
} }
```

### GET /api/stats/trend/daily
```ts
{ ok: true, data: { points: [{ date: string, score: number, totalDeduction: number }] } }
// 仅有效日，按日期升序
```

### GET /api/stats/trend/weekly
```ts
{ ok: true, data: { points: [{ key: string /* 周一日期 */, label: string /* 08/10-08/16 */, rate: number }] } }
// 仅包含有有效日的周，按时间升序
```

### GET /api/stats/trend/monthly
```ts
{ ok: true, data: { points: [{ key: string /* 2026-08 */, label: string, rate: number }] } }
```

### GET /api/stats/personal?month=YYYY-MM
```ts
// month 可省略 → 默认最新有数据的月份
{ ok: true, data: {
  selectedMonth: string | null,   // 实际选中的月份（无任何数据时为 null）
  months: string[],               // 所有有有效记录的月份（升序，供切换器）
  users: [{ userId: number, name: string, deduction: number }], // 7 人，按 sort 排序
} }
```

### GET /api/stats/frequency?month=YYYY-MM
```ts
{ ok: true, data: {
  selectedMonth: string | null,
  months: string[],
  items: [{ key: string, label: string, count: number }], // 固定 8 项：床面/床下地面/垃圾桶/阳台地面/室内地面/厕所/洗衣槽/置物桌
} }
```

### GET /api/stats/discipline
```ts
{ ok: true, data: { records: [{ date: string, talkAm: number, talkPm: number, count: number }] } }
// 仅违纪次数 > 0 的日期，按日期倒序
```

---

## 5. 管理接口（全部要求 ADMIN）

### GET /api/admin/inspections?from=YYYY-MM-DD&to=YYYY-MM-DD
```ts
// from/to 均可省略；记录按日期升序
{ ok: true, data: { records: [EnrichedRecord] } }
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
  date: string,       // 必须 ≤ 今天
  dutyUserId: number, // 当天状态必须为 NORMAL
  talkAm: number,     // 非负整数
  talkPm: number,
  userStatus: [{ userId: number, status: 'NORMAL' | 'LEAVE' }], // 7 人完整
  bedChecks: [{ period: Period, bedId: number, item: BedItem }],
  publicChecks: [{ period: Period, item: PublicItem }],
  reason?: string,    // 修改原因（非必填）
}
// 成功 200
{ ok: true, data: { record: EnrichedRecord, action: 'created' | 'updated' | 'unchanged' } }
// 409 DATE_CONFLICT：改日期时目标日期已有记录；400 各类校验失败
```

### POST /api/admin/inspections/:id/revoke（可带 { reason }）
### POST /api/admin/inspections/:id/restore（可带 { reason }）
```ts
{ ok: true, data: { record: EnrichedRecord, action: 'updated' | 'unchanged' } }
// unchanged = 重复操作（幂等，不重复记日志）
```

### GET /api/admin/audit-logs?limit=50&offset=0
```ts
{ ok: true, data: {
  total: number,
  logs: [{
    id: number, operator: string,           // 固定 "管理员"
    action: 'CREATE' | 'UPDATE' | 'REVOKE' | 'RESTORE' | 'CHANGE_PASSWORD' | 'UPDATE_CONFIG',
    target: string,                         // 如 "inspection:2026-08-16"
    beforeJson: string | null,              // 修改前数据（JSON 字符串）
    afterJson: string | null,               // 修改后数据
    reason: string | null,
    createdAt: string,                      // ISO 时间
  }],
} }
// 按 id 倒序（最新在前）；limit 最大 100
```

### PUT /api/admin/passwords
```ts
// 请求（至少修改一个密码，新密码 4-64 位）
{ currentAdminPassword: string, viewerPassword?: string, adminPassword?: string }
// 成功 200：{ ok: true, data: null }
// 401 INVALID_CURRENT_PASSWORD
```

### EnrichedRecord 完整结构
```ts
{
  id: number,
  date: string, weekday: string,            // 如 "星期日"
  dutyUserId: number, dutyUserName: string,
  status: 'ACTIVE' | 'REVOKED',
  talkAm: number, talkPm: number,
  userStatus: [{ userId: number, userName: string, status: 'NORMAL' | 'LEAVE' }],
  bedChecks: [{ period: Period, bedId: number, bedName: string, item: BedItem, itemLabel: string }],
  publicChecks: [{ period: Period, item: PublicItem, itemLabel: string }],
  bedDeduction: number, publicDeduction: number,
  disciplineDeduction: number, talkCount: number,
  totalDeduction: number, score: number,
  createdAt: string, updatedAt: string,
}
```

---

## 6. 前端对接要点

1. 会话 Cookie 由服务端下发（HttpOnly），前端所有请求 `credentials: 'include'`；收到 401 且 code=UNAUTHORIZED 时跳登录页。
2. 展示页对 VIEWER 隐藏一切写入口；后端亦强制拦截（双保险）。
3. 录入页"今天"与"星期"：星期直接使用接口返回的 `weekday` 字段或自行计算；日期选择器 max 设为今天（Asia/Shanghai，与后端一致）。
4. 月份切换器使用各接口返回的 `months` 数组，默认选中 `selectedMonth`（最新有数据月份）。
5. 录入页实时统计由前端按 §1.3 规则本地计算，仅作展示；以提交后服务端返回为准。
6. 修改历史记录时带上 `id`；改日期可能返回 409 DATE_CONFLICT，需要向用户展示错误。
