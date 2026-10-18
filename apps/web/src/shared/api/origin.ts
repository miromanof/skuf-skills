function isLocalHost(hostname: string): boolean {
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function resolveApiBaseUrl(configured: unknown, hostname: string): string {
  const value = typeof configured === 'string' ? configured.trim().replace(/\/+$/u, '') : '';
  if (!value) {
    if (isLocalHost(hostname)) return 'http://127.0.0.1:3001';
    throw new Error('VITE_API_BASE_URL is required outside localhost');
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('VITE_API_BASE_URL must be a valid URL'); }
  if (url.protocol !== 'https:') throw new Error('VITE_API_BASE_URL must use HTTPS');
  if (url.origin !== value || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL must contain an origin only');
  }
  return value;
}

export function resolveApiUrl(path: string, configured: unknown, hostname: string): string {
  if (!path.startsWith('/')) throw new Error('API path must start with a slash');
  return `${resolveApiBaseUrl(configured, hostname)}${path}`;
}

export function apiUrl(path: string): string {
  return resolveApiUrl(path, import.meta.env.VITE_API_BASE_URL, window.location.hostname);
}
