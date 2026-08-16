// 单日计算：宿舍扣分与得分（1.md §18-§20）
import { BASE_SCORE, BED_ITEM_POINTS, PUBLIC_ITEM_POINTS, TALK_POINTS } from '../constants';
import type { InspectionRecord } from '../types';

export interface DailyResult {
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
  totalDeduction: number;
  /** 每日得分 = max(0, 20 - 总扣分)；原始扣分完整保留 */
  score: number;
}

export function computeDaily(record: InspectionRecord): DailyResult {
  const bedDeduction = record.bedChecks.length * BED_ITEM_POINTS;
  const publicDeduction = record.publicChecks.length * PUBLIC_ITEM_POINTS;
  const talkCount = record.talkAm + record.talkPm;
  const disciplineDeduction = talkCount * TALK_POINTS;
  const totalDeduction = bedDeduction + publicDeduction + disciplineDeduction;
  return {
    bedDeduction,
    publicDeduction,
    disciplineDeduction,
    talkCount,
    totalDeduction,
    score: Math.max(0, BASE_SCORE - totalDeduction),
  };
}
