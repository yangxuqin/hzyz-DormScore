# DormScore · 宿舍分数可视化系统

以「每日 20 分宿舍总分」为核心、以**扣分池**（检查时段 × 检查位置）为床位扣分模型、
以命中床位上的成员作为个人分摊依据、以纪律作为宿舍独立扣分项，通过展示页与管理页分离
实现安全管理的宿舍卫生与纪律可视化系统。

- 工程规范（**AI Agent / 开发必读**）：[AGENTS.md](AGENTS.md)
- 业务规则：[docs/business-rules.md](docs/business-rules.md)
- 系统架构：[docs/architecture.md](docs/architecture.md)
- 接口契约：[docs/API.md](docs/API.md)
- 数据库：[docs/database.md](docs/database.md)
- UI 设计（MD3E）：[docs/ui.md](docs/ui.md)

## 功能一览

**展示页 / Dashboard**（展示密码进入，只读）

- 成绩概览：今日得分环形大数字、今日扣分构成、本周/本月得分率
- 日历看板：桌面「日历 + 当日明细」双栏；0–20 分 tonal 视觉分级；点击日期看明细
- 成绩趋势：日得分、周得分率、月得分率
- 个人分析：7 人月累计个人扣分（床位/公共构成）与值日天数
- 卫生扣分频次：8 个检查项目发生次数
- 纪律记录：只列出实际违纪的日期与次数

**管理页**（管理密码进入）

- 每日录入：以「时段 × 区域扣分池」选择命中床位，实时显示责任人与人均分摊、实时统计
- 历史记录：按日期/周/月查询、修改（含改日期）、撤回、恢复、导出当前筛选结果为 CSV
- 操作日志：新增/修改/撤回/恢复/改密/改配置全量留痕（前后快照 + 原因）
- 设置：成员姓名与床位调整、展示/管理双密码修改

## 核心业务规则（摘要）

| 规则          | 说明                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| 每日基础分 20 | 只扣分无加分；得分 = max(0, 20 − 总扣分)，原始扣分完整保留                                 |
| ★ 扣分池      | 「时段 × 区域」= 一个扣分池，固定 2 分；**多张床命中同一池也只扣 2 分**；全天床位最多 8 分 |
| 个人分摊      | 命中床位上排除请假者后，剩余正常成员均分该池：`池扣分 ÷ 正常人数`（允许小数）              |
| 全员请假      | 宿舍仍扣该池分，个人无人承担（合法，个人总和 ≠ 宿舍扣分）                                  |
| 公共区域      | 6 项各 1 分/项，**全部归当天值日生**；请假人员不能当值日生                                 |
| 纪律          | 讲话 2 分/次，**永远不计入任何个人**；展示页只列违纪日期                                   |
| 有效日        | 当天有 ACTIVE 记录才算有效日；周/月得分率只统计有效日                                      |
| 请假          | 只免除个人责任，不免除宿舍扣分                                                             |
| 撤回          | 不物理删除，状态 REVOKED，不参与统计，可恢复                                               |

完整规则、示例与端到端算例见 [docs/business-rules.md](docs/business-rules.md)。

## 技术栈

| 层   | 技术                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| 后端 | Cloudflare Workers + Hono + D1（SQLite）                                     |
| 前端 | Vue 3 + TypeScript + Vite + vue-router + Pinia + ECharts（响应式，移动优先） |
| 契约 | `packages/contracts` 前后端共享类型包                                        |
| 部署 | GitHub Actions 自动部署（含 D1 迁移），Workers 免费版                        |
| 测试 | Vitest：领域单元测试 + API 集成测试（内存仓储）                              |

## 目录结构

```
├── AGENTS.md            # 工程规范（最高优先级）
├── packages/contracts/  # 前后端共享 API 契约类型
├── worker/              # Cloudflare Worker
│   ├── src/domain/      # ★ 业务规则唯一实现处（扣分池、分摊、统计）
│   ├── src/application/ # 用例编排
│   ├── src/infrastructure/ # 仓储接口与 D1 实现
│   ├── src/interfaces/  # HTTP 路由与 presenter
│   ├── migrations/      # D1 迁移（含种子）
│   └── test/            # 领域 + API 测试
├── web/                 # Vue 3 前端（pages / features / components / styles）
└── docs/                # 业务规则 / 架构 / 数据库 / UI / API
```

## 本地开发

要求：Node ≥ 22、pnpm ≥ 9、wrangler（随 worker 依赖安装）。

```bash
pnpm install

# 1) 本地 D1 初始化（执行迁移并写入种子数据）
pnpm db:migrate:local

# 2) 构建前端静态资源（Worker 会托管它；开发期改前端代码需重新构建）
pnpm -C web build

# 3) 启动 Worker（http://localhost:8787，代理本地 D1）
pnpm dev:worker

# 4) 前端热更新开发（可选，http://localhost:5173，/api 自动代理到 8787）
pnpm dev:web
```

初始密码（部署后请立即在「设置」中修改）：展示入口 `admin`、管理入口 `admin`。

## 测试与质量

```bash
pnpm test          # 后端全部测试（领域规则 + API 全流程）
pnpm typecheck     # 前后端类型检查
pnpm build         # 前端构建
pnpm format:check  # Prettier 格式检查
```

## 部署到 Cloudflare（首次）

1. 创建 D1 数据库并记录 database_id：
   ```bash
   cd worker && pnpm exec wrangler d1 create dorm-score-db
   ```
2. 把返回的 `database_id` 填入 `worker/wrangler.toml` 的 `database_id` 字段
3. GitHub 仓库 Settings → Secrets and variables → Actions 添加：
   - `CLOUDFLARE_API_TOKEN`（Workers 编辑权限）
   - `CLOUDFLARE_ACCOUNT_ID`
4. 推送 main 分支 → CI 自动测试、执行 D1 迁移并部署；成功后在 Dashboard → Workers 页面获取 `*.workers.dev` 域名

## 提交规范

- Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` + 中文描述
- 后端规则变更必须同步补充 `worker/test` 中的对应用例
- 接口变更必须同步 `packages/contracts` 与 `docs/API.md`

## 已知取舍

- 床位-成员映射为全局配置，调整后历史个人分摊按新映射重算（换宿舍属罕见事件，届时建议开新学年）
- 登录限流为 Worker 内存计数，冷启动会重置（免费版限制，基础防护）
- 数据导出（Excel）列为后续功能；当前支持在历史记录页导出 CSV（含扣分池与个人分摊）
