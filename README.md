# 宿舍分数可视化系统

以「每日 20 分宿舍总分」为核心、以床位责任和当日值日生为个人扣分依据、以纪律作为宿舍独立扣分项，
并通过展示页与管理页分离实现安全管理的宿舍卫生与纪律可视化系统。

- 开发计划：[开发计划.md](开发计划.md)
- 接口契约：[docs/API.md](docs/API.md)

## 功能一览

**展示页**（展示密码进入，只读）

- 成绩概览：今日得分 / 今日扣分 / 本周得分率 / 本月得分率
- 成绩趋势：日得分、周得分率、月得分率三个图表
- 个人分析：7 人月累计个人扣分柱状图（可切换月份）
- 卫生扣分频次：8 个检查项目发生次数（可切换月份）
- 纪律记录：只列出实际违纪的日期与次数

**管理页**（管理密码进入）

- 每日录入：日期/星期自动、值日生、7 人请假状态、上午/下午检查、实时统计、一天一条（重复提交即更新）
- 历史记录：按日期/周/月查询、修改（含改日期）、撤回、恢复
- 操作日志：新增/修改/撤回/恢复/改密/改配置全量留痕（前后数据快照 + 原因）
- 设置：成员姓名与床位调整、展示/管理双密码修改

## 核心业务规则（摘要）

| 规则          | 说明                                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| 每日基础分 20 | 只扣分无加分；得分 = max(0, 20 − 总扣分)，原始扣分完整保留                                           |
| 床位个人区域  | 床面/床下地面各 2 分/项，按当天请假状态分摊：两人正常 1+1；一人请假 在场者 2；都请假 0+0（宿舍仍扣） |
| 公共区域      | 垃圾桶/阳台地面/室内地面/厕所/洗衣槽/置物桌各 1 分/项，**全部归当天值日生**                          |
| 纪律          | 讲话 2 分/次，**永远不计入任何个人**；展示页只列违纪日期                                             |
| 有效日        | 当天有 ACTIVE 记录才算有效日；周/月得分率只统计有效日                                                |
| 请假          | 只免除个人责任，不免除宿舍扣分；请假人员不能当值日生                                                 |
| 撤回          | 不物理删除，状态 REVOKED，不参与任何统计，可恢复                                                     |

完整规则与示例见 1.md；计算引擎单元测试覆盖了其中全部业务示例。

## 技术栈

| 层   | 技术                                                                         |
| ---- | ---------------------------------------------------------------------------- |
| 后端 | Cloudflare Workers + Hono + D1（SQLite）                                     |
| 前端 | Vue 3 + TypeScript + Vite + vue-router + Pinia + ECharts（响应式，移动优先） |
| 部署 | GitHub Actions 自动部署（含 D1 迁移），Workers 免费版                        |
| 测试 | Vitest：计算引擎单元测试 + API 集成测试（内存 Store）                        |

## 目录结构

```
├── worker/          # Cloudflare Worker：API、计算引擎、D1 迁移与种子、测试
│   ├── src/calc/    # 核心计算引擎（纯函数，业务规则唯一实现处）
│   ├── src/routes/  # auth / viewer / admin 路由
│   ├── src/store/   # 数据访问层接口 + D1 实现
│   ├── migrations/  # 数据库迁移（含初始床位/成员/密码种子）
│   └── test/        # 单元 + 集成测试
├── web/             # Vue 3 前端（登录 / 展示 / 管理）
├── docs/API.md      # 接口契约
└── .github/workflows/deploy.yml
```

## 本地开发

要求：Node ≥ 22、pnpm ≥ 9、wrangler（随 worker 依赖安装）。

```bash
pnpm install

# 1) 本地 D1 初始化（一次性；执行迁移并写入种子数据）
pnpm db:migrate:local

# 2) 构建前端静态资源（Worker 会托管它；开发期改前端代码需重新构建）
pnpm -C web build

# 3) 启动 Worker（http://localhost:8787，代理本地 D1）
pnpm dev:worker

# 4) 前端热更新开发（可选，http://localhost:5173，/api 自动代理到 8787）
pnpm dev:web
```

初始密码（部署后请立即在「管理页 → 设置」中修改）：

- 展示入口：`admin`
- 管理入口：`admin`

## 测试与质量

```bash
pnpm test          # 后端全部测试（计算规则 + API 全流程）
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
   - `CLOUDFLARE_API_TOKEN`（Cloudflare Dashboard → My Profile → API Tokens，Workers 编辑权限）
   - `CLOUDFLARE_ACCOUNT_ID`（Dashboard 首页右侧）
4. 推送 main 分支 → CI 自动测试、执行 D1 迁移并部署；成功后在 Dashboard → Workers 页面获取 `*.workers.dev` 域名

## 提交规范

- Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `test` / `chore` + 中文描述
- 后端规则变更必须同步补充 `worker/test` 中的对应用例
- 接口变更必须同步更新 `docs/API.md`

## 已知取舍（详见 开发计划.md §9）

- 床位-成员映射为全局配置，调整后历史个人分摊按新映射重算（换宿舍属罕见事件，届时建议开新学年）
- 登录限流为 Worker 内存计数，冷启动会重置（免费版限制，基础防护）
- 数据导出（Excel/CSV）为 V2 功能
