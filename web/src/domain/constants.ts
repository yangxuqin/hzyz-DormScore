// 前端领域常量与标签（数值/枚举与 worker 领域层保持一致）
import type { BedItem, Period, PublicItem } from '@dorm/contracts';

export const BASE_SCORE = 20;
/** 一个床位扣分池固定扣分（与 worker BED_POOL_POINTS 一致，仅用于录入页实时预览） */
export const BED_POOL_POINTS = 2;
export const PUBLIC_ITEM_POINTS = 1;
export const TALK_POINTS = 2;

export const PERIODS: Period[] = ['AM', 'PM'];
export const BED_ITEMS: BedItem[] = ['BED', 'FLOOR'];
export const PUBLIC_ITEMS: PublicItem[] = ['TRASH', 'BALCONY', 'INDOOR', 'TOILET', 'SINK', 'TABLE'];

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

export function periodLabel(period: Period): string {
  return PERIOD_LABELS[period];
}
