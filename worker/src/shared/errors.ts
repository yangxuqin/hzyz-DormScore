// 错误码 → HTTP 状态码映射（应用层只返回 code，接口层决定 HTTP 语义）
export function statusForCode(code: string): number {
  switch (code) {
    case 'UNAUTHORIZED':
    case 'INVALID_CURRENT_PASSWORD':
    case 'INVALID_PASSWORD':
      return 401;
    case 'FORBIDDEN':
    case 'CSRF_REJECTED':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'DATE_CONFLICT':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    case 'NOT_INITIALIZED':
    case 'INTERNAL':
      return 500;
    default:
      return 400;
  }
}
