// 领域常量与枚举标签 —— 业务规则的唯一数值来源（与 1.md / docs/business-rules.md 对应）
import type { BedItem, Period, PublicItem } from '@dorm/contracts';

/** 每日基础分（系统只扣分、无加分） */
export const BASE_SCORE = 20;

/**
 * ★ 床位「扣分池」固定扣分。
 *
 * 一个扣分池 = 时段（AM/PM）× 区域（BED/FLOOR）。同一池无论命中几张床都只扣
 * 本值一次；命中床位数只决定责任分摊范围，绝不参与乘法。
 */
export const BED_POOL_POINTS = 2;

/** 每个公共区域项目扣分（按 时段 × 项目 计） */
export const PUBLIC_ITEM_POINTS = 1;
/** 每次讲话扣分（宿舍级别，永不摊到个人） */
export const TALK_POINTS = 2;

export const OPERATOR_NAME = '管理员';

export const SESSION_COOKIE = 'dorm_session';
/** 长期会话：一年（浏览器信任） */
export const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;

export const PASSWORD_MIN_LENGTH = 4;
export const PASSWORD_MAX_LENGTH = 64;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_SECONDS = 10 * 60;

/**
 * 初始密码（展示/管理均为 admin）的 PBKDF2 哈希。
 * 由迁移种子写入 settings 表；首次部署后请尽快在管理页修改。
 */
export const INITIAL_PASSWORD_HASH =
  'pbkdf2$100000$ZG9ybXNjb3JlLXYxLXNlZWQ=$RXVqJhBuD3xrR2TPpAGDZLuaQmYDgPaug0cqduCUnl8=';

export const PERIODS = ['AM', 'PM'] as const satisfies readonly Period[];
export const BED_ITEMS = ['BED', 'FLOOR'] as const satisfies readonly BedItem[];
export const PUBLIC_ITEMS = [
  'TRASH',
  'BALCONY',
  'INDOOR',
  'TOILET',
  'SINK',
  'TABLE',
] as const satisfies readonly PublicItem[];

export const PERIOD_LABELS: Record<Period, string> = { AM: '上午', PM: '下午' };

export const BED_ITEM_LABELS: Record<BedItem, string> = {
  BED: '床面',
  FLOOR: '床下地面',
};

export const PUBLIC_ITEM_LABELS: Record<PublicItem, string> = {
  TRASH: '垃圾桶',
  BALCONY: '阳台地面',
  INDOOR: '室内地面',
  TOILET: '厕所',
  SINK: '洗衣槽',
  TABLE: '置物桌',
};

/** 卫生扣分频次统计的 8 个项目（固定顺序） */
export interface HygieneFrequencyItem {
  key: string;
  label: string;
}

export const HYGIENE_FREQUENCY_ITEMS: HygieneFrequencyItem[] = [
  { key: 'BED', label: BED_ITEM_LABELS.BED },
  { key: 'FLOOR', label: BED_ITEM_LABELS.FLOOR },
  ...PUBLIC_ITEMS.map((i) => ({ key: i, label: PUBLIC_ITEM_LABELS[i] })),
];
