// 每日检查记录仓储：读写整条记录（含扣分池与明细）
import type { InspectionStatus } from '@dorm/contracts';
import type { InspectionInput, InspectionRecord } from '../../domain/dorm/model';

export interface InspectionRepository {
  /** 按日期范围查询（升序）；无参数则全部 */
  list(from?: string, to?: string): Promise<InspectionRecord[]>;
  getByDate(date: string): Promise<InspectionRecord | null>;
  getById(id: number): Promise<InspectionRecord | null>;
  /** 按 date 唯一键创建或更新 */
  upsert(input: InspectionInput): Promise<InspectionRecord>;
  setStatus(id: number, status: InspectionStatus): Promise<InspectionRecord | null>;
}
