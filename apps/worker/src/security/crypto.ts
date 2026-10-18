const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hmacSign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}

export function secureEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function encodeBase64Url(value: string): string {
  return bytesToBase64Url(encoder.encode(value));
}

export function decodeBase64Url(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

export async function encodeCursor(offset: number, secret: string): Promise<string> {
  const payload = encodeBase64Url(JSON.stringify({ offset }));
  return `${payload}.${await hmacSign(payload, secret)}`;
}

export async function decodeCursor(cursor: string | undefined, secret: string): Promise<number> {
  if (!cursor) return 0;
  const [payload, signature, extra] = cursor.split('.');
  if (!payload || !signature || extra || !secureEqual(signature, await hmacSign(payload, secret))) throw new Error('invalid-cursor');
  try {
    const parsed = JSON.parse(decodeBase64Url(payload)) as { offset?: unknown };
    if (!Number.isSafeInteger(parsed.offset) || Number(parsed.offset) < 0) throw new Error('invalid-cursor');
    return Number(parsed.offset);
  } catch {
    throw new Error('invalid-cursor');
  }
}
