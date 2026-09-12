// 展示统计用例：日 / 周 / 月趋势
import type { DailyTrendPoint, MonthlyTrendPoint, WeeklyTrendPoint } from '@dorm/contracts';
import { dailyTrend, monthlyTrend, weeklyTrend } from '../../domain/dorm/statistics';
import type { Repositories } from '../../infrastructure/repositories';

export async function getDailyTrend(repos: Repositories): Promise<DailyTrendPoint[]> {
  return dailyTrend(await repos.inspections.list());
}

export async function getWeeklyTrend(repos: Repositories): Promise<WeeklyTrendPoint[]> {
  return weeklyTrend(await repos.inspections.list());
}

export async function getMonthlyTrend(repos: Repositories): Promise<MonthlyTrendPoint[]> {
  return monthlyTrend(await repos.inspections.list());
}
