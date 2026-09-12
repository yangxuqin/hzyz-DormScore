# AGENTS.md — DormScore 工程规范（AI Coding Agent 必读）

> 本文件是整个项目未来所有 AI Coding Agent / 开发者的**最高级工程规范**。
> 修改任何代码前先读本文件；本文件与代码冲突时，以业务规则章节和代码中的领域层为准，并立即修正文档。

---

## 0. 阅读顺序

1. 本文件（全局规范）
2. `docs/business-rules.md`（业务规则唯一权威说明，尤其「扣分池」模型）
3. `docs/architecture.md`（分层与依赖方向）
4. `docs/database.md`（表结构与迁移策略）
5. `docs/ui.md`（MD3E 设计系统与响应式）
6. `docs/API.md`（接口契约）

---

## 1. 项目简介

**DormScore（宿舍分数可视化系统）**：以「每日 20 分宿舍总分」为核心，按检查时段与区域形成
**扣分池**，以命中床位上的成员作为个人分摊依据，以纪律作为宿舍级独立扣分项，提供展示页
（只读可视化大屏/看板）与管理页（安全录入、历史、日志、设置）。

- 用户角色：`VIEWER`（展示，只读）、`ADMIN`（管理，可写）。单管理员、共享密码。
- 使用周期：一学年；寒暑假不录入即不产生有效日。

## 2. 技术栈（不得无必要更换）

| 层     | 技术                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| 后端   | Cloudflare Workers + Hono + D1（SQLite）                                     |
| 前端   | Vue 3 + TypeScript + Vite + vue-router + Pinia + ECharts（响应式，移动优先） |
| 契约   | `packages/contracts`（前后端共享纯类型包）                                   |
| 测试   | Vitest（领域单元测试 + API 集成测试，内存仓储）                              |
| 部署   | GitHub Actions → Cloudflare Workers（含 D1 迁移）                            |
| 包管理 | pnpm workspace                                                               |

## 3. 系统架构

```
浏览器（Vue 3 SPA）
   │  HTTPS + HttpOnly Cookie Session
   ▼
Cloudflare Workers（单个 Worker，worker/）
   ├── 静态资源：web/dist（Workers Static Assets，绑定 ASSETS）
   └── /api/*：Hono 路由
   ▼
Cloudflare D1（SQLite）
```

依赖方向（**严格单向，禁止反向依赖**）：

```
interfaces/http  →  application  →  domain
        ↓                 ↓            ↑
        └──────────► infrastructure ───┘（只被 application 依赖）
```

- `domain` 不依赖 Hono / D1 / Cloudflare，纯函数 + 纯类型。
- `application` 编排用例，只依赖 `domain` 与仓储**接口**。
- `infrastructure` 实现仓储接口（D1）。
- `interfaces/http` 负责 HTTP 解析、鉴权中间件、把应用层 `Result` 映射为响应。
- `app` 负责组装（依赖注入）。

## 4. 目录结构

```
hzyz-DormScore/
├── AGENTS.md                    # 本文件
├── README.md
├── package.json / pnpm-workspace.yaml
├── packages/contracts/          # 前后端共享 API 契约类型
├── worker/                      # Cloudflare Worker
│   ├── src/
│   │   ├── app/                 # createApp / routes / context
│   │   ├── domain/dorm/         # ★ 领域层（业务规则唯一实现处）
│   │   │   ├── model.ts         # 领域模型（BedPool 等）
│   │   │   ├── constants.ts     # 扣分常量与枚举标签
│   │   │   ├── rules.ts         # 扣分池 / 床位 / 请假工具
│   │   │   ├── scoring.ts       # 单日宿舍扣分与得分
│   │   │   ├── sharing.ts       # 个人分摊
│   │   │   ├── validation.ts    # 输入校验
│   │   │   └── statistics.ts    # 概览/趋势/日历/频次/纪律
│   │   ├── application/         # 用例（inspections / statistics / settings）
│   │   ├── infrastructure/      # repositories（接口）+ d1（实现）
│   │   ├── interfaces/http/     # auth / viewer / admin / config / presenter / respond
│   │   ├── auth/                # 密码、会话、限流、中间件
│   │   └── shared/              # date / errors / result / utils
│   ├── migrations/              # D1 迁移（含种子）
│   └── test/                    # 领域 + API 测试
├── web/                         # Vue 3 前端
│   └── src/
│       ├── app/                 # App.vue / bootstrap.ts
│       ├── layouts/             # AdminLayout
│       ├── pages/               # 路由页面（DisplayPage / LoginPage / admin/*）
│       ├── features/            # dashboard / calendar / inspection / analytics / discipline / history / settings
│       ├── components/ui/       # MD3E 组件（MButton/MCard/...）
│       ├── components/charts/   # ECharts 封装与图表
│       ├── api/                 # client + endpoints
│       ├── stores/              # auth / theme
│       ├── composables/         # useToast
│       ├── domain/              # 前端常量与本地计算
│       ├── styles/              # tokens.css + base.css
│       └── utils/               # date
├── docs/                        # API / architecture / business-rules / database / ui
└── .github/workflows/deploy.yml
```

> 说明：项目保留 `worker/` 与 `web/` 顶层目录（未迁移到 `apps/`），以匹配现有 Cloudflare
> 部署结构；职责分离与 `apps/worker`、`apps/web` 等价。

## 5. Domain 业务模型

核心对象（见 `worker/src/domain/dorm/model.ts` 与 `packages/contracts`）：

```ts
interface BedPool {
  period: 'AM' | 'PM'; // 检查时段
  item: 'BED' | 'FLOOR'; // 床位区域
  beds: number[]; // 命中的床位 id（升序、去重）——只决定责任人
  deduction: number; // 该池扣分快照（当前规则 2）
}
```

## 6. 宿舍扣分规则（★ 必须彻底理解）

**「检查时段 × 检查位置」= 一个扣分池，固定扣 2 分。**

- 检查时段只有 `AM`（上午）/ `PM`（下午），两者完全独立。
- 床位检查位置只有 `BED`（床面/床架）/ `FLOOR`（床下地面）。
- 因此存在且仅存在 4 个床位扣分池：`AM+BED`、`AM+FLOOR`、`PM+BED`、`PM+FLOOR`。
- **每个池最多扣 2 分；全天床位最多扣 8 分。**

**多个床位同时命中时，只扣一个 2 分**：

- 上午 1 床床下与 3 床床下都出问题 → `AM+FLOOR` = 2 分（**不是 4 分**）。
- 命中的床位数**只用于确定责任人员**，绝不参与乘法。

禁止出现类似 `bedChecks.length * 2` 作为床位扣分核心逻辑。合法写法是按池求和
（`sumPoolDeduction`）或 `pools.length * BED_POOL_POINTS`（每个池固定 2 分）。

## 7. 个人分摊规则

对每个扣分池：

1. 取该池所有命中床位 `beds`；
2. 找出这些床位上的全部成员；
3. 排除当天 `LEAVE`（请假）人员；
4. 剩余正常成员共同分担：`每人 = pool.deduction ÷ 正常责任人数`。

示例：`AM FLOOR, beds=[1,3]`，正常人员 User1/User2/User5/User6 → 宿舍 -2，个人各 0.5。

## 8. 公共区域规则

公共区域 6 项：垃圾桶 / 阳台地面 / 室内地面 / 厕所 / 洗衣槽 / 置物桌。按「时段 × 项目」计，
每项 1 分。**全部归当天值日生**。请假人员不能成为值日生（后端强制校验 `DUTY_USER_ON_LEAVE`）。

## 9. 纪律规则

纪律为**宿舍级别**：讲话 2 分/次（上午 + 下午合计）。**永不计入任何个人扣分**。
展示页只列出实际存在违纪的日期与次数，不产生空白纪律记录。

## 10. 请假规则

- 请假只免除**个人责任**，不免除宿舍扣分。
- 若某池命中床位上的成员全部请假：宿舍仍扣该池 2 分，个人无人承担（合法结果）。
- 请假人员不能担任当天值日生。

## 11. 有效日规则

- 当天存在 `ACTIVE` 记录才算**有效日**；`REVOKED`（撤回）等同于无记录。
- 周得分率 = 本周有效日得分总和 ÷（20 × 有效天数）× 100%（周一~周日）。
- 月得分率同理，按自然月。无有效日的周/月不产生数据点。

## 12. 数据库规范

- 表结构见 `docs/database.md`。
- **禁止修改已有 migration 的历史内容**，一律新增 migration 文件。
- 迁移需可回放、可自校验；涉及数据转换必须做一致性检查。
- 扣分池保存 `deduction_points` 快照，历史记录不随未来常量变化而重算。
- 日期一律 `YYYY-MM-DD` 字符串（Asia/Shanghai），禁止存时间戳再转时区。

## 13. API 规范

- 统一前缀 `/api`；统一响应包装 `{ ok, data }` / `{ ok, error: { code, message } }`。
- 除登录外均需会话 Cookie；写接口必须 `ADMIN`。
- 契约唯一来源：`packages/contracts`；接口文档同步更新 `docs/API.md`。
- `EnrichedRecord.bedChecks` 是扣分池数组，返回命中床位、固定扣分与责任人分摊；前端不得自行猜测。

## 14. 前端架构规范

- `pages/` 只做路由与数据编排；业务展示拆到 `features/`。
- 展示页禁止把所有逻辑塞进单个组件；Dashboard 由 `features/dashboard`、`features/calendar`、
  `features/analytics`、`features/discipline` 组合。
- ECharts 的 `option` 不得写在页面文件里；页面只传数据，图表组件负责 option。
- API 访问统一走 `web/src/api/endpoints.ts`，不散落拼路径。

## 15. UI / MD3E 设计规范

- 全站 Material 3 Expressive：语义化 Color / Typography / Shape / Elevation / Motion tokens，
  定义在 `web/src/styles/tokens.css`。
- 组件禁止直接写死 hex，使用 `--md-*` / `--shape-*` / `--elev-*` / `--motion-*` 令牌。
- 配色：沉稳自然的绿色/青绿色主色，暖金/米色为辅。禁止霓虹赛博、紫色渐变 SaaS、
  大面积玻璃拟态、过多阴影、传统 Admin Template 外观。
- 排版有层级（Display/Headline/Title/Body/Label），关键数字使用大字号。
- 形状分级：小控件 8~~12px、卡片 20~~24px、hero 28~32px。
- 动效 150~300ms，快、柔和、不晃；尊重 `prefers-reduced-motion`。

## 16. 响应式规范

- 断点：`<768` 手机；`768~1023` 平板；`>=1024` 桌面；`>=1440` 大屏。
- 内容最大宽度 `--content-max: 1440px`，大屏居中，禁止无限拉伸。
- 日历与当日明细：桌面 1024+ 为双栏（`1.35fr / 0.65fr`）；平板上下；手机上下。
  禁止出现「日历太窄 / 明细被挤到下面 / 右侧巨大空白」。
- 管理导航：桌面 Navigation Rail，手机 Navigation Bar。

## 17. 状态管理规范

- Pinia 只保存真正的全局状态：`auth`、`theme`。
- 页面数据由页面/feature 局部 state 或 composable 管理，不塞进全局 store。

## 18. ECharts 规范

- 图表组件位于 `components/charts/`，每个图一个组件，页面只传 `points`/`items`/`users`。
- 基础封装 `EChartBase.vue` 负责 init / resize / dispose / 主题联动。
- 配色从 CSS 变量读取（`chartTheme.ts`），dark mode 自动切换。

## 19. 测试规范

- 领域规则必须覆盖：多床位只扣 2 分、四个池最多 8 分、请假、全员请假、小数个人分摊、
  公共区域、纪律、撤回、恢复、修改、日期冲突、历史迁移。
- 至少存在断言：`AM FLOOR beds=[1,3]` → `bedDeduction === 2`；四池全命中 → `bedDeduction === 8`。
- 运行：`pnpm test`、`pnpm typecheck`、`pnpm build`。

## 20. Git 规范

- Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` + 中文描述。
- 重构分支：`refactor/v2-architecture-md3e`（或后续同类命名）。
- 不删改用户未提交修改；不执行 `git reset --hard`、`checkout -- .`、强制清理。

## 21. 重构规范

- 先建代码地图，再动手；确认无引用后才删除旧文件。
- 不留 `foo-old` / `foo-v2` / `foo-refactor` 过渡垃圾。
- 迁移后必须删除失效的旧目录、旧 store、重复 types、重复 CSS。

## 22. 禁止事项

- 禁止把「每张床一个检查项 = 2 分」当作扣分单位（V1 旧模型）。
- 禁止 `bedChecks.length * 2` 式的床位扣分。
- 禁止在 HTTP 路由中直接操作 D1（必须经 application → repository）。
- 禁止破坏既有安全设计：HttpOnly / Secure / SameSite=Lax Cookie、PBKDF2、session hash、
  角色隔离、CSRF、登录限流。
- 禁止修改已发布 migration 内容。
- 禁止引入重量级 UI 框架或非必要依赖。
- 禁止使用 `any`，除非有充分理由并注释说明。

## 23. 常见错误

- 把 AM/PM 或 BED/FLOOR 合并计算（必须独立）。
- 把纪律扣分摊到个人（纪律永远是宿舍级）。
- 把个人扣分总和当作必须等于宿舍扣分（全员请假时二者不等，合法）。
- 让前端自己推断责任分摊（应由后端返回）。
- 路由守卫与 auth store 相互触发导致无限重定向。

## 24. 部署规范

1. 创建 D1 数据库并把 `database_id` 填入 `worker/wrangler.toml`。
2. GitHub Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`。
3. push `main` → CI 执行测试 → 构建前端 → `wrangler d1 migrations apply --remote` → `wrangler deploy`。
4. 上线后立即在「设置」修改初始密码（默认 `admin`）。

## 25. 修改业务规则时必须同步哪些文件

修改**业务规则**（扣分、分摊、请假、纪律、公共区域、有效日）时，必须同步：

1. `worker/src/domain/dorm/*`（模型/常量/规则/计算/校验）
2. `packages/contracts`（如涉及字段变化）
3. `worker/test/*`（新增/修正断言）
4. `docs/business-rules.md`（规则说明与示例）
5. `AGENTS.md`（第 5~11 章对应条目）
6. 前端展示（`web/src/features/**`、`web/src/domain/**`），且**不得改变计算归属**

修改 **API** 时，必须同步：`packages/contracts` → `worker`（application/interfaces）→
`web`（api/endpoints/features）→ `docs/API.md` → `worker/test`。

修改 **UI** 时，不得改变任何业务计算结果与数据含义。
