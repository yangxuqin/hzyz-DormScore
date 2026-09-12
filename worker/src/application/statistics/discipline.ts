// 展示统计用例：纪律记录（仅真实违纪日期）
import type { DisciplineRecord } from '@dorm/contracts';
import { disciplineRecords } from '../../domain/dorm/statistics';
import type { Repositories } from '../../infrastructure/repositories';

export async function getDisciplineRecords(repos: Repositories): Promise<DisciplineRecord[]> {
  return disciplineRecords(await repos.inspections.list());
}
