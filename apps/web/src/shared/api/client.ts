export type AdminContent = {
  id: string;
  type: 'term' | 'meme';
  title: string;
  explanation: string;
  example: string;
  context?: string;
  origin?: string;
  media?: { kind: 'video'; url: string } | { kind: 'image'; uploadToken: string };
  tags: string[];
  author?: string;
  status: 'pending' | 'published' | 'rejected' | 'unpublished' | 'deleted';
  version: string;
  createdAt: string;
  updatedAt: string;
  correction?: {
    targetSlug: string;
    changeNote: string;
    original?: { title: string; explanation: string; example: string; tags: string[]; context?: string; origin?: string; media?: AdminContent['media'] };
  };
};

function apiUrl(path: string): string {
  const origin = ['127.0.0.1', 'localhost'].includes(window.location.hostname) ? 'http://127.0.0.1:3001' : '';
  return `${origin}${path}`;
}

export type PublicContent = {
  slug: string; type: 'term' | 'meme'; title: string; explanation: string; example: string; tags: string[];
  context?: string; origin?: string; author?: string; bucket: string; publishedAt: string;
  media?: { kind: 'video'; url: string } | { kind: 'image'; uploadToken: string };
};

export async function publicRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), { ...(signal ? { signal } : {}) });
  if (!response.ok) throw new Error(`public request failed: ${response.status}`);
  return await response.json() as T;
}

export async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<{ response: Response; data: T | null }> {
  const csrfToken = sessionStorage.getItem('skuf-admin-csrf');
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  if (csrfToken && init.method && init.method !== 'GET') headers.set('x-csrf-token', csrfToken);
  const response = await fetch(apiUrl(path), { ...init, headers, credentials: 'include' });
  const data = response.status === 204 ? null : await response.json() as T;
  return { response, data };
}
