// 会话令牌：256 位随机令牌，库中只存 SHA-256 哈希
import { SESSION_TTL_SECONDS } from '../constants';

export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}
