// 统一 Result 类型：领域/应用层不抛异常，用返回值表达失败
export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; code: string; message: string };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(code: string, message: string): Err {
  return { ok: false, code, message };
}
