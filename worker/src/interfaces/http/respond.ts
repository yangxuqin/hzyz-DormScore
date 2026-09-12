// 接口层工具：Result → HTTP 响应；查询参数解析
import type { Context } from 'hono';
import { statusForCode } from '../../shared/errors';
import { apiError, apiOk } from '../../shared/utils';
import type { Result } from '../../shared/result';
import { isValidMonthString } from '../../shared/date';
import type { AppEnv } from '../../app/context';

/** 把应用层 Result 映射为统一的 JSON 响应与 HTTP 状态码 */
export function respond<T>(c: Context<AppEnv>, result: Result<T>): Response {
  if (result.ok) return c.json(apiOk(result.value));
  return c.json(apiError(result.code, result.message), statusForCode(result.code) as 400);
}

/** 解析 ?month=YYYY-MM；缺省返回 null；非法返回 { error } */
export function parseMonthParam(c: Context<AppEnv>): string | null | { error: string } {
  const raw = c.req.query('month');
  if (raw === undefined || raw === '') return null;
  if (!isValidMonthString(raw)) return { error: '月份格式应为 YYYY-MM' };
  return raw;
}
