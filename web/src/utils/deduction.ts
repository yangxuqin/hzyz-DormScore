import type { BedItem, Period, PublicItem } from '../api/types';

/** 扣分规则（与 worker/src/constants.ts 一致，仅录入页实时统计本地计算用） */
export const BASE_SCORE = 20;
export const BED_ITEM_POINTS = 2;
export const PUBLIC_ITEM_POINTS = 1;
export const TALK_POINTS = 2;

export const BED_ITEM_LABELS: Record<BedItem, string> = {
  BED: '床面',
  FLOOR: '床下地面',
};

export const PUBLIC_ITEMS: PublicItem[] = ['TRASH', 'BALCONY', 'INDOOR', 'TOILET', 'SINK', 'TABLE'];

export const PUBLIC_ITEM_LABELS: Record<PublicItem, string> = {
  TRASH: '垃圾桶',
  BALCONY: '阳台地面',
  INDOOR: '室内地面',
  TOILET: '厕所',
  SINK: '洗衣槽',
  TABLE: '置物桌',
};

export const PERIODS: Period[] = ['AM', 'PM'];

export const PERIOD_LABELS: Record<Period, string> = {
  AM: '上午',
  PM: '下午',
};

export interface LocalDeductionSummary {
  bedCount: number;
  publicCount: number;
  talkCount: number;
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  totalDeduction: number;
  score: number;
}

export function computeDeductions(
  bedCount: number,
  publicCount: number,
  talkCount: number,
): LocalDeductionSummary {
  const bedDeduction = bedCount * BED_ITEM_POINTS;
  const publicDeduction = publicCount * PUBLIC_ITEM_POINTS;
  const disciplineDeduction = talkCount * TALK_POINTS;
  const totalDeduction = bedDeduction + publicDeduction + disciplineDeduction;
  return {
    bedCount,
    publicCount,
    talkCount,
    bedDeduction,
    publicDeduction,
    disciplineDeduction,
    totalDeduction,
    score: Math.max(0, BASE_SCORE - totalDeduction),
  };
}

/** 得分率显示：去掉多余的尾零 */
export function formatRate(rate: number): string {
  return String(parseFloat(rate.toFixed(2)));
}
