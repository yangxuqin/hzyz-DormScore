// API 客户端：统一 methods / credentials / 错误处理 / 401 单例处理
import type { ApiErrorBody } from '@dorm/contracts';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * 全局唯一的会话失效处理入口。
 * 注册方负责清空会话并（最多一次）跳转登录页，避免无限重定向。
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

async function parsePayload<T>(res: Response): Promise<T> {
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new ApiError('INTERNAL', '服务器响应格式错误', res.status);
  }
  const payload = raw as { ok?: boolean; data?: T; error?: ApiErrorBody } | null;
  if (payload && payload.ok === true) return payload.data as T;

  const err: ApiErrorBody = payload?.error ?? {
    code: 'INTERNAL',
    message: `请求失败（HTTP ${res.status}）`,
  };
  if (res.status === 401 && err.code === 'UNAUTHORIZED') {
    unauthorizedHandler?.();
  }
  throw new ApiError(err.code, err.message, res.status);
}

export type QueryParams = Record<string, string | number | undefined | null>;

function buildUrl(path: string, params?: QueryParams): string {
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

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: { params?: QueryParams; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(buildUrl(`/api${path}`, options.params), {
    method,
    credentials: 'include',
    ...(method === 'GET'
      ? {}
      : {
          headers: JSON_HEADERS,
          body: options.body === undefined ? '{}' : JSON.stringify(options.body),
        }),
  });
  return parsePayload<T>(res);
}

export function apiGet<T>(path: string, params?: QueryParams): Promise<T> {
  return request<T>('GET', path, { params });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, { body });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PUT', path, { body });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

/** 统一错误提示文案 */
export function errorMessage(e: unknown, fallback = '操作失败，请重试'): string {
  return e instanceof ApiError ? e.message : fallback;
}
