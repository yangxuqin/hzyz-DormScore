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
