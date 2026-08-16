import type { ApiErrorBody } from './types';

/** API 请求错误：携带后端错误码 */
export class ApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** 注册 401 UNAUTHORIZED 处理（清空会话并跳转登录页） */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

async function parsePayload<T>(res: Response): Promise<T> {
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new ApiError('INTERNAL', '服务器响应格式错误');
  }
  const payload = raw as { ok?: boolean; data?: T; error?: ApiErrorBody } | null;
  if (payload && payload.ok === true) {
    return payload.data as T;
  }
  const err: ApiErrorBody = payload?.error ?? {
    code: 'INTERNAL',
    message: `请求失败（HTTP ${res.status}）`,
  };
  if (res.status === 401 && err.code === 'UNAUTHORIZED') {
    unauthorizedHandler?.();
  }
  throw new ApiError(err.code, err.message);
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | undefined | null>,
): string {
  if (!params) return path;
  const search = Object.entries(params)
    .filter(
      (entry): entry is [string, string | number] =>
        entry[1] !== undefined && entry[1] !== null && entry[1] !== '',
    )
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return search ? `${path}?${search}` : path;
}

const JSON_HEADERS: Record<string, string> = { 'Content-Type': 'application/json' };

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined | null>,
): Promise<T> {
  const res = await fetch(buildUrl(`/api${path}`, params), { credentials: 'include' });
  return parsePayload<T>(res);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: body === undefined ? '{}' : JSON.stringify(body),
  });
  return parsePayload<T>(res);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: body === undefined ? '{}' : JSON.stringify(body),
  });
  return parsePayload<T>(res);
}

/** 统一错误提示文案 */
export function errorMessage(e: unknown, fallback = '操作失败，请重试'): string {
  return e instanceof ApiError ? e.message : fallback;
}
