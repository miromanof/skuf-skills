import { useEffect, useState } from 'react';
import { adminRequest, type AdminContent } from '../../shared/api/client.js';

const filters = [
  ['pending', 'Новые'], ['published', 'Опубликованные'], ['rejected', 'Отклонённые'], ['unpublished', 'Снятые'],
] as const;

export function AdminQueuePage() {
  const [status, setStatus] = useState<(typeof filters)[number][0]>('pending');
  const [items, setItems] = useState<AdminContent[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    void adminRequest<{ items: AdminContent[] }>(`/api/admin/content?status=${status}`, { signal: controller.signal }).then(({ response, data }) => {
      if (response.status === 401) { sessionStorage.removeItem('skuf-admin-csrf'); window.location.hash = '#/admin/login'; return; }
      if (!response.ok || !data) throw new Error('queue failed');
      setItems(data.items); setState('ready');
    }).catch((error) => { if (error instanceof Error && error.name !== 'AbortError') setState('error'); });
    return () => controller.abort();
  }, [status]);

  const logout = async () => { await adminRequest('/api/admin/logout', { method: 'POST' }); sessionStorage.removeItem('skuf-admin-csrf'); window.location.hash = '#/admin/login'; };

  return <section className="admin-page"><div className="admin-page__heading"><div><p className="eyebrow"><span /> Редакция</p><h1>Очередь модерации</h1></div><button className="text-link admin-logout" type="button" onClick={logout}>Выйти</button></div><div className="admin-filters" aria-label="Фильтр очереди">{filters.map(([value, label]) => <button type="button" aria-pressed={status === value} onClick={() => setStatus(value)} key={value}>{label}</button>)}</div>{state === 'loading' && <p role="status">Загружаем заявки…</p>}{state === 'error' && <p className="form-status form-status--error" role="alert">Не удалось загрузить очередь.</p>}{state === 'ready' && items.length === 0 && <p className="admin-empty">В этом разделе пока пусто.</p>}<div className="admin-list">{items.map((item) => <a href={`#/admin/content/${item.id}`} className="admin-list__item" key={item.id}><span>{item.type === 'term' ? 'Слово' : 'Мем'} · {item.status}</span><strong>{item.title}</strong><small>{item.explanation}</small><b>Открыть ↗</b></a>)}</div></section>;
}
