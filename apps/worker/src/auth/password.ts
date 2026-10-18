import { secureEqual } from '../security/crypto.js';

export const PBKDF2_ITERATIONS = 210_000;

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export async function derivePasswordKey(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(salt), iterations: PBKDF2_ITERATIONS }, material, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  try { return secureEqual(await derivePasswordKey(password, salt), expected); } catch { return false; }
}
