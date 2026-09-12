// 密码哈希：PBKDF2-SHA256 + 随机盐，格式 pbkdf2$iterations$saltB64$hashB64
const PBKDF2_ITERATIONS = 100000;
const MAX_ACCEPTED_ITERATIONS = 1_000_000;

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array | null {
  try {
    const raw = atob(s);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function deriveBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const hash = await deriveBits(password, salt, iterations);
  return `pbkdf2$${iterations}$${toB64(salt)}${'$'}${toB64(hash)}`;
}

export function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return derive(password, salt, PBKDF2_ITERATIONS);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0 || iterations > MAX_ACCEPTED_ITERATIONS) {
    return false;
  }
  const salt = fromB64(parts[2]!);
  const expected = fromB64(parts[3]!);
  if (!salt || !expected || expected.length === 0) return false;
  const actual = await deriveBits(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}
