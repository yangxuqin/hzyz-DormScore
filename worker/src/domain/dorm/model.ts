// 领域模型：宿舍检查记录与扣分池
import type {
  Bed,
  BedItem,
  InspectionStatus,
  Period,
  PublicItem,
  User,
  UserStatus,
} from '@dorm/contracts';

/** 床位基础配置（等同契约 Bed，领域内别名） */
export type BedRow = Bed;
export type UserRow = User;

export interface AppConfig {
  beds: BedRow[];
  users: UserRow[];
}

export interface UserStatusEntry {
  userId: number;
  status: UserStatus;
}

/**
 * ★ 床位扣分池（核心领域对象）。
 *
 * 语义：`period + item` 唯一确定一个池，`deduction` 是该池固定扣分（历史快照），
 * `beds` 是命中的床位 id（升序、去重），仅用于确定责任人员范围。
 */
export interface BedPool {
  period: Period;
  item: BedItem;
  beds: number[];
  /** 该池扣分（快照，不依赖未来常量变化） */
  deduction: number;
}

export interface PublicCheckEntry {
  period: Period;
  item: PublicItem;
}

/** 完整的一条每日检查记录（含明细，由 Repository 组装） */
export interface InspectionRecord {
  id: number;
  /** YYYY-MM-DD */
  date: string;
  dutyUserId: number;
  talkAm: number;
  talkPm: number;
  status: InspectionStatus;
  createdAt: string;
  updatedAt: string;
  userStatus: UserStatusEntry[];
  /** 床位扣分池（最多 4 个） */
  bedChecks: BedPool[];
  publicChecks: PublicCheckEntry[];
}

/** 录入/修改时校验后的规范输入（未含 id/状态，由服务端确定） */
export interface InspectionInput {
  date: string;
  dutyUserId: number;
  talkAm: number;
  talkPm: number;
  userStatus: UserStatusEntry[];
  bedChecks: BedPool[];
  publicChecks: PublicCheckEntry[];
}
