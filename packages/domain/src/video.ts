export type ParsedVideo = { provider: 'rutube' | 'youtube'; videoId: string; embedUrl: string };

export function parseVideoUrl(value: string): ParsedVideo {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Некорректная ссылка на видео'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Разрешены только безопасные HTTPS-ссылки');

  if (url.hostname === 'rutube.ru' || url.hostname === 'www.rutube.ru') {
    const match = url.pathname.match(/^\/video\/([a-f0-9]{32})\/?$/i);
    if (!match) throw new Error('Некорректная ссылка RuTube');
    return { provider: 'rutube', videoId: match[1]!, embedUrl: `https://rutube.ru/play/embed/${match[1]}` };
  }

  let id: string | null = null;
  if (url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com') id = url.pathname === '/watch' ? url.searchParams.get('v') : null;
  if (url.hostname === 'youtu.be') id = url.pathname.slice(1).split('/')[0] ?? null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Некорректная ссылка YouTube');
  return { provider: 'youtube', videoId: id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
}
