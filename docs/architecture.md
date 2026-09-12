# 系统架构

## 1. 总览

```
浏览器（Vue 3 SPA，web/）
   │  HTTPS + HttpOnly Cookie Session（同域，无跨域）
   ▼
Cloudflare Workers（单 Worker，worker/）
   ├── Static Assets：web/dist（绑定 ASSETS，SPA 回退 index.html）
   └── /api/*：Hono 路由
   ▼
Cloudflare D1（SQLite）
```

同域部署，前端构建产物作为 Worker 静态资源，天然规避跨域与 Cookie 限制。

## 2. 后端分层

严格单向依赖：

```
interfaces/http   ──► application ──► domain
        │                  │            ▲
        └──────────► infrastructure ────┘
```

| 层              | 目录                         | 职责                                                       | 允许依赖             |
| --------------- | ---------------------------- | ---------------------------------------------------------- | -------------------- |
| domain          | `worker/src/domain/dorm`     | 业务规则唯一实现处（模型、扣分、分摊、校验、统计），纯函数 | 仅 `@dorm/contracts` |
| application     | `worker/src/application`     | 用例编排（录入、撤回恢复、统计查询、设置）                 | domain、仓储接口     |
| infrastructure  | `worker/src/infrastructure`  | 仓储接口与 D1 实现                                         | domain、contracts    |
| interfaces/http | `worker/src/interfaces/http` | HTTP 解析、鉴权、Result→响应映射、presenter                | application、auth    |
| app             | `worker/src/app`             | 组装、依赖注入、路由挂载                                   | 上述全部             |
| auth            | `worker/src/auth`            | 密码哈希、会话、限流、中间件                               | shared、contracts    |
| shared          | `worker/src/shared`          | date / errors / result / utils                             | 无                   |

### 2.1 关键流程：POST /api/admin/inspections

```
HTTP Route (interfaces/http/admin.ts)
  ↓ 解析 body / id
saveInspection (application/inspections/saveInspection.ts)
  ↓ getConfig → validateInspectionInput（domain/dorm/validation.ts）
  ↓ 定位目标记录（by id / by date）
  ↓ 日期冲突检查
  ↓ inspections.upsert（infrastructure/d1）
  ↓ normalizeRecord / enrichRecord（interfaces/http/presenter.ts）
  ↓ 变更时 audit.add
Result → respond() → JSON
```

HTTP 路由**不直接操作 D1**；所有数据访问经仓储接口（`infrastructure/repositories`）。

## 3. 仓储拆分

| 仓储                   | 职责                     |
| ---------------------- | ------------------------ |
| `InspectionRepository` | 每日记录读写（含扣分池） |
| `ConfigRepository`     | 床位/成员映射、密码哈希  |
| `SessionRepository`    | 会话令牌哈希             |
| `AuditRepository`      | 操作日志                 |

`Repositories` 聚合接口由 `createD1Repositories(db)` 实现；测试注入内存实现
（`worker/test/mem-store.ts`），因此 API 集成测试无需真实 D1。

## 4. 前端分层

```
pages/        路由页面，负责数据编排
layouts/      布局（AdminLayout：Rail / Bottom Nav）
features/     业务展示组件（dashboard / calendar / inspection / analytics / discipline / history）
components/ui      MD3E 设计系统组件
components/charts  ECharts 封装与具体图表
api/          client（fetch 封装、401 单例）+ endpoints（类型化端点）
stores/       Pinia：auth、theme（仅全局状态）
composables/  useToast
domain/       前端常量与本地实时计算（与后端规则一致）
styles/       tokens.css（设计令牌）+ base.css（语义类）
```

## 5. 认证与启动流程

```
main.ts bootstrap()
  → 创建 app + pinia
  → theme.init()（挂载前应用，避免闪烁）
  → setUnauthorizedHandler（全局唯一 401 处理）
  → await auth.ensureLoaded()  // GET /api/auth/me
  → app.use(router) → mount
```

- 路由守卫只读取已确认的 `auth.role`，不发起网络请求，避免与 store 循环。
- 401 处理：清空会话；仅当不在 `/login` 时跳转一次登录页，杜绝无限重定向。

## 6. 安全设计（保留，不得破坏）

| 项       | 实现                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| 会话     | 256 位随机令牌，库中只存 SHA-256 哈希；HttpOnly + Secure + SameSite=Lax Cookie，365 天 |
| 密码     | Web Crypto PBKDF2-SHA256，10 万次迭代，独立随机盐，不存明文                            |
| 角色隔离 | 后端中间件强制：展示会话无法调用任何写接口                                             |
| CSRF     | SameSite=Lax + 仅接受 JSON + 校验 Origin（本机开发豁免）                               |
| 登录限流 | Worker 内存按 IP+角色计数，5 次失败锁 10 分钟（冷启动重置）                            |
| 审计     | 录入/修改/撤回/恢复/改密/改配置全量留痕（快照 + 原因）                                 |

## 7. 部署

GitHub Actions（`.github/workflows/deploy.yml`）：

```
push main
  → pnpm install
  → worker test / typecheck
  → web typecheck / build
  → prettier --check
  →（deploy job）wrangler d1 migrations apply --remote
  → wrangler deploy
```

本地开发：

```bash
pnpm install
pnpm db:migrate:local      # 初始化本地 D1
pnpm -C web build          # Worker 托管前端产物
pnpm dev:worker            # http://localhost:8787
pnpm dev:web               # http://localhost:5173（/api 代理到 8787）
```
