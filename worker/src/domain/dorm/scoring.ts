// 单日计算：宿舍扣分与得分（扣分池模型）
import { BASE_SCORE, PUBLIC_ITEM_POINTS, TALK_POINTS } from './constants';
import type { InspectionRecord } from './model';
import { sumPoolDeduction } from './rules';

export interface DailyResult {
  /** 床位扣分 = 各扣分池快照之和（每池最多 2 分，全天最多 8 分） */
  bedDeduction: number;
  publicDeduction: number;
  disciplineDeduction: number;
  talkCount: number;
  totalDeduction: number;
  /** 每日得分 = max(0, 20 - 总扣分)；原始扣分完整保留 */
  score: number;
}

export function computeDaily(record: InspectionRecord): DailyResult {
  const bedDeduction = sumPoolDeduction(record.bedChecks);
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
