// 业务常量与领域枚举 —— 与 1.md 需求一一对应

/** 每日基础分（系统只扣分、无加分） */
export const BASE_SCORE = 20;
/** 每个床位不合格项目（床面/床下地面）扣分 */
export const BED_ITEM_POINTS = 2;
/** 每个公共区域项目扣分 */
export const PUBLIC_ITEM_POINTS = 1;
/** 每次讲话扣分 */
export const TALK_POINTS = 2;

export const TIMEZONE = 'Asia/Shanghai';
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

export type Period = 'AM' | 'PM';
export type UserStatus = 'NORMAL' | 'LEAVE';
export type BedItem = 'BED' | 'FLOOR';
export type PublicItem = 'TRASH' | 'BALCONY' | 'INDOOR' | 'TOILET' | 'SINK' | 'TABLE';
export type InspectionStatus = 'ACTIVE' | 'REVOKED';
export type Role = 'VIEWER' | 'ADMIN';
export type PasswordKey = 'admin' | 'viewer';

export const BED_ITEM_LABELS: Record<BedItem, string> = {
  BED: '床面',
  FLOOR: '床下地面',
};

export const PUBLIC_ITEMS: readonly PublicItem[] = [
  'TRASH',
  'BALCONY',
  'INDOOR',
  'TOILET',
  'SINK',
  'TABLE',
] as const;

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
