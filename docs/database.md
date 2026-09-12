# 数据库设计

> Cloudflare D1（SQLite）。迁移文件位于 `worker/migrations/`。
> **禁止修改已有 migration 内容**，一律新增文件。日期一律 `YYYY-MM-DD`（Asia/Shanghai）。

## 1. 表结构

### beds 床位

| 列   | 类型    | 说明                         |
| ---- | ------- | ---------------------------- |
| id   | INTEGER | 主键                         |
| name | TEXT    | 如 `1床`                     |
| type | TEXT    | `double`（上下铺）/ `single` |
| sort | INTEGER | 排序                         |

### users 成员

| 列       | 类型    | 说明                         |
| -------- | ------- | ---------------------------- |
| id       | INTEGER | 主键                         |
| name     | TEXT    | 姓名（初始 User1~User7）     |
| bed_id   | INTEGER | → beds.id                    |
| position | TEXT    | `upper` / `lower` / `single` |
| sort     | INTEGER | 排序                         |

### daily_inspections 每日检查记录（date 唯一）

| 列           | 类型    | 说明                      |
| ------------ | ------- | ------------------------- |
| id           | INTEGER | 主键                      |
| date         | TEXT    | `YYYY-MM-DD`，**UNIQUE**  |
| duty_user_id | INTEGER | 值日生 → users.id         |
| talk_am/pm   | INTEGER | 上午/下午讲话次数，默认 0 |
| status       | TEXT    | `ACTIVE` / `REVOKED`      |
| created_at   | TEXT    | ISO 时间戳                |
| updated_at   | TEXT    | ISO 时间戳                |

### daily_user_status 成员当天状态

| 列            | 类型    | 说明                   |
| ------------- | ------- | ---------------------- |
| inspection_id | INTEGER | → daily_inspections.id |
| user_id       | INTEGER | → users.id             |
| status        | TEXT    | `NORMAL` / `LEAVE`     |

主键 `(inspection_id, user_id)`。状态挂在记录上，保证历史回看不失真。

### inspection_bed_checks ★ 床位扣分池（V2 核心）

| 列               | 类型    | 说明                               |
| ---------------- | ------- | ---------------------------------- |
| id               | INTEGER | 主键                               |
| inspection_id    | INTEGER | → daily_inspections.id             |
| period           | TEXT    | `AM` / `PM`                        |
| item             | TEXT    | `BED`（床面）/ `FLOOR`（床下地面） |
| deduction_points | INTEGER | 该池扣分快照（默认 2）             |

约束：`UNIQUE (inspection_id, period, item)`。**一条记录的同一时段同一区域只能有一个池。**

### inspection_bed_check_beds 扣分池 ↔ 命中床位

| 列       | 类型    | 说明                       |
| -------- | ------- | -------------------------- |
| check_id | INTEGER | → inspection_bed_checks.id |
| bed_id   | INTEGER | → beds.id                  |

主键 `(check_id, bed_id)`。命中床位数只决定责任分摊范围，不影响扣分金额。

### inspection_public_checks 公共区域检查（勾选才插入）

| 列            | 类型    | 说明                                                         |
| ------------- | ------- | ------------------------------------------------------------ |
| inspection_id | INTEGER | → daily_inspections.id                                       |
| period        | TEXT    | `AM` / `PM`                                                  |
| item          | TEXT    | `TRASH` / `BALCONY` / `INDOOR` / `TOILET` / `SINK` / `TABLE` |

唯一键 `(inspection_id, period, item)`。

### audit_logs 操作日志

| 列                     | 类型 | 说明                                                                   |
| ---------------------- | ---- | ---------------------------------------------------------------------- |
| operator               | TEXT | 固定 `管理员`                                                          |
| action                 | TEXT | `CREATE`/`UPDATE`/`REVOKE`/`RESTORE`/`CHANGE_PASSWORD`/`UPDATE_CONFIG` |
| target                 | TEXT | 如 `inspection:2026-08-16`                                             |
| before_json/after_json | TEXT | 前后快照（JSON）                                                       |
| reason                 | TEXT | 原因（可空）                                                           |

### settings 系统设置（key-value）

`admin_password_hash`、`viewer_password_hash`（PBKDF2 哈希，初始均为 `admin`）。

### sessions 会话

| 列         | 类型 | 说明               |
| ---------- | ---- | ------------------ |
| token_hash | TEXT | 主键（仅存哈希）   |
| role       | TEXT | `VIEWER` / `ADMIN` |
| expires_at | TEXT | 过期时间           |

## 2. 迁移历史

| 文件                 | 内容                                                |
| -------------------- | --------------------------------------------------- |
| `0001_init.sql`      | 初始表结构与种子（4 床位、7 成员、初始密码）        |
| `0002_bed_pools.sql` | **V2 扣分池模型迁移**（旧逐床明细 → 池 + 命中床位） |

### 2.1 0002 迁移策略

旧模型：

```
inspection_bed_checks (inspection_id, period, bed_id, item)   -- 每行 = 一张床的一个区域
```

新模型：

```
inspection_bed_checks      (inspection_id, period, item, deduction_points)  UNIQUE(inspection_id, period, item)
inspection_bed_check_beds  (check_id, bed_id)
```

迁移步骤（在单个 migration 内完成）：

1. 旧表 `RENAME` 为 `inspection_bed_checks_legacy`（先保留）；
2. 建新池表与床位关联表；
3. `INSERT ... SELECT DISTINCT`：每个 `(inspection_id, period, item)` 生成一个池，`deduction_points = 2`；
4. 把旧行的 `bed_id` 关联到对应新池（去重）；
5. **一致性检查**：`COUNT(legacy rows) == COUNT(new bed links)`，否则迁移中止（`CHECK` 断言失败）；
6. 校验通过后 `DROP` 旧表。

示例：旧数据 `AM/FLOOR/1` 与 `AM/FLOOR/3` → 一个新池 `AM/FLOOR`，`beds=[1,3]`，扣 2 分
（**不是两个池共 4 分**）。转换无损，可由「池 + 命中床位」完整还原旧明细。

## 3. 数据一致性

- 所有统计**实时**从原始记录计算，不落库缓存，天然规避「改历史导致统计不一致」。
- 撤回（`REVOKED`）不物理删除，不参与统计。
- 扣分池 `deduction_points` 为历史快照，规则常量变化不影响历史。
