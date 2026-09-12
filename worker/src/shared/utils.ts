// 通用工具：API 响应包装与基础类型守卫

/** 统一的 API 响应包装 */
export function apiError(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}

export function apiOk<T>(data: T) {
  return { ok: true as const, data };
}

export function isNonNegativeInteger(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** D1 取值为宽松类型，统一收窄 */
export function toNum(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0);
}

export function toStr(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}
