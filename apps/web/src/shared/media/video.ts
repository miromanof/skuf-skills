export type ExternalVideo = { provider: 'rutube' | 'youtube'; embedUrl: string };

export function parseExternalVideoUrl(raw: string): ExternalVideo {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Неподдерживаемая ссылка на видео'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Неподдерживаемая ссылка на видео');

  if (url.hostname === 'rutube.ru' || url.hostname === 'www.rutube.ru') {
    const match = url.pathname.match(/^\/video\/([a-f0-9]{32})\/?$/i);
    if (!match || url.search || url.hash) throw new Error('Неподдерживаемая ссылка на видео');
    return { provider: 'rutube', embedUrl: `https://rutube.ru/play/embed/${match[1]}` };
  }

  let id: string | null = null;
  if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') id = url.pathname === '/watch' ? url.searchParams.get('v') : null;
  if (url.hostname === 'youtu.be') id = url.pathname.match(/^\/([A-Za-z0-9_-]{11})\/?$/)?.[1] ?? null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Неподдерживаемая ссылка на видео');
  return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
}
