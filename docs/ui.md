# UI 设计规范（Material 3 Expressive）

> 设计令牌定义于 `web/src/styles/tokens.css`，语义类定义于 `web/src/styles/base.css`。
> 组件中禁止直接写死 hex。

## 1. 设计定位

Material 3 Expressive + 学术数据看板 + 宿舍生活感 + 平静的数据可视化。

氛围关键词：干净、温和、年轻、有学校生活感、有数据感，但**不是**企业后台。

禁止：

- Neon cyberpunk、紫色渐变 SaaS 风
- 大面积玻璃拟态、过多阴影
- 过度圆润导致幼稚
- 传统 Admin Template 外观

## 2. 色彩（语义令牌）

主色为沉稳自然的**绿色 / 青绿色**，辅以**暖金 / 米色 / 柔和橙**，不使用刺眼高饱和色。

Light 关键令牌：`--md-surface`、`--md-surface-container(-low/-high/-highest)`、`--md-surface-variant`、
`--md-on-surface(-variant)`、`--md-primary(-container)`、`--md-secondary`、`--md-tertiary`、`--md-error`。

### 2.1 Dark Mode

暗夜模式使用 MD3 **semantic surface 层级**（`surface` / `surface-container-low` / `container` /
`container-high` / `container-highest`）构建层次感，而非把背景简单改黑。

### 2.2 得分档位（tonal，避免刺眼红绿）

| 得分   | 档位 | 令牌                |
| ------ | ---- | ------------------- |
| 20     | 优秀 | `--score-excellent` |
| 15–19  | 良好 | `--score-good`      |
| 10–14  | 一般 | `--score-fair`      |
| 5–9    | 较差 | `--score-poor`      |
| 0–4    | 严重 | `--score-critical`  |
| 无记录 | —    | `--score-none`      |

## 3. 字体层级

遵循 MD3：Display / Headline / Title / Body / Label（见 `--text-*`）。

- 关键数字必须有强视觉层级，例如「今日得分 20 / 20」用 `MScoreRing` 的大数字。
- 数字统一使用 `font-variant-numeric: tabular-nums`（`.numeric`）。

## 4. 形状

Expressive 分级，不全局统一 8px：

| 层级      | 圆角                         |
| --------- | ---------------------------- |
| 小控件    | `--shape-sm/md` (8/12px)     |
| 卡片      | `--shape-xl/2xl` (20/24px)   |
| 大型 hero | `--shape-3xl/hero` (28/32px) |

## 5. 层级（Elevation）

克制使用 `--elev-1` ~ `--elev-4`；卡片默认描边 + 极浅阴影，交互时提升。

## 6. 动效（Motion）

- 时长 150–300ms（`--motion-fast/medium/slow`）。
- 覆盖场景：页面进入、Card hover、Chip selected、Calendar selected、Dialog/Bottom sheet、
  Toast、数据刷新。
- 必须快、柔和、不晃、不影响效率；尊重 `prefers-reduced-motion`。

## 7. 组件库

| 组件           | 用途                                      |
| -------------- | ----------------------------------------- |
| `MButton`      | filled / tonal / outlined / text / danger |
| `MCard`        | elevated / filled / outlined / hero       |
| `MIcon`        | 内联 SVG 线性图标（无图标依赖）           |
| `MSegmented`   | 分段控件                                  |
| `MModal`       | 移动端底部抽屉 / 桌面居中对话框           |
| `MStateBox`    | Loading / Empty / Error + Retry 三态      |
| `MScoreRing`   | 今日得分环形大数字                        |
| `MThemeToggle` | 明亮 / 暗夜切换                           |
| `ToastHost`    | 全局轻量提示                              |

## 8. 页面布局

- 展示页：顶部 DormScore 品牌 → Summary（今日得分环形 + 今日扣分/周率/月率）→
  Calendar | Day Detail 双栏 → 趋势 → 个人/频次 → 纪律。
- 管理页：桌面 Navigation Rail（录入/历史/日志/设置），手机 Navigation Bar。
- 历史记录页标题右侧提供「导出 CSV」按钮，导出当前筛选结果（客户端生成，不新增接口）。

## 9. 日历

- 桌面（≥1024）：`日历 | 当日明细` 双栏，比例 `1.35fr / 0.65fr`，消除右侧巨大空白。
- 平板（768–1023）：上下排列。
- 手机（<768）：上下排列；单元格只显示日期，分值在明细面板查看。

## 10. 响应式

| 断点       | 设备 |
| ---------- | ---- |
| `<768`     | 手机 |
| `768–1023` | 平板 |
| `≥1024`    | 桌面 |
| `≥1440`    | 大屏 |

内容最大宽度 `1440px`，大屏居中，禁止无限拉伸。

## 11. 录入页（Admin Entry）

必须以「时段 × 区域扣分池」呈现，禁止「1床 [床面][床下]」式逐床复选（会误导为每床扣 2 分）。

结构：

```
上午
  床面  [1床][2床][3床][4床]   当前 2 / 2 分
  床下  [1床][2床][3床][4床]   当前 2 / 2 分
```

选中床位后即时显示：已选床位、扣分、责任人员、人均分摊（请假动态更新）。
页面实时统计：床位 / 公共 / 纪律 / 总扣分 / 得分。

## 12. 可访问性

- 交互元素有 `aria-label` / `aria-pressed` / `aria-selected` / `role`。
- 键盘可达，`:focus-visible` 可见焦点环。
- 状态不只用颜色表达（配合文字/徽标）。
