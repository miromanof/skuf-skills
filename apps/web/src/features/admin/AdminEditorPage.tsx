import { useEffect, useState, type FormEvent } from 'react';
import { adminRequest, type AdminContent } from '../../shared/api/client.js';
import { parseExternalVideoUrl } from '../../shared/media/video.js';
import { DeleteConfirmation } from './DeleteConfirmation.js';
type Draft = Pick<AdminContent, 'type' | 'title' | 'explanation' | 'example' | 'tags'> & {
    context?: string;
    origin?: string;
    author?: string;
    media?: AdminContent['media'];
};
type Original = NonNullable<NonNullable<AdminContent['correction']>['original']>;
type Decision = 'accepted' | 'rejected';
const legacyOriginals: Record<string, Original> = {
    'скуф': {
        title: 'Скуф', explanation: 'Ироничное название немодного взрослого мужчины, который отстал от трендов.',
        example: '«Включил режим скуфа и лёг спать в десять»',
        context: 'Употребляется в неформальной речи, переписке, комментариях и соцсетях. Интонация и отношения между собеседниками могут менять оттенок значения.',
        origin: 'Слово закрепилось в русскоязычной интернет-среде и постепенно перешло из переписки в устную речь.', tags: [],
    },
};
const comparisonFields: Array<{
    key: keyof Original;
    label: string;
}> = [
    { key: 'title', label: 'Название' }, { key: 'explanation', label: 'Объяснение' }, { key: 'example', label: 'Пример' },
    { key: 'context', label: 'Контекст' }, { key: 'origin', label: 'Происхождение' }, { key: 'media', label: 'Ссылка на видео' }, { key: 'tags', label: 'Теги' },
];
function displayValue(value: Original[keyof Original] | undefined): string {
    if (Array.isArray(value))
        return value.join(', ') || '—';
    if (value && typeof value === 'object')
        return value.kind === 'video' ? value.url : value.uploadToken;
    return value || '—';
}
function CorrectionComparison({ item, decisions, onDecision }: {
    item: AdminContent;
    decisions: Partial<Record<keyof Original, Decision>>;
    onDecision: (key: keyof Original, decision: Decision) => void;
}) {
    if (!item.correction)
        return null;
    const original = item.correction.original ?? legacyOriginals[item.correction.targetSlug];
    const changed = original ? comparisonFields.filter(({ key }) => displayValue(original[key]) !== displayValue(item[key] as Original[keyof Original] | undefined)) : [];
    return <section className="admin-comparison" aria-labelledby="comparison-title"><p className="eyebrow"><span /> Проверка правки</p><h2 id="comparison-title">Что предлагают изменить</h2><p className="admin-comparison__note"><strong>Комментарий:</strong> {item.correction.changeNote}</p>{!original ? <p>Исходная версия этой карточки недоступна.</p> : changed.length === 0 ? <p>Значения полей не изменены.</p> : <div className="admin-comparison__rows">{changed.map(({ key, label }) => <article className={`admin-comparison__row${decisions[key] ? ` admin-comparison__row--${decisions[key]}` : ''}`} data-testid={`comparison-${key}`} key={key}><h3>{label}</h3><div><span>Было</span><p>{displayValue(original[key])}</p></div><div><span>Стало</span><p>{displayValue(item[key] as Original[keyof Original] | undefined)}</p><div className="admin-comparison__choices"><button type="button" aria-label={`Принять изменение «${label}»`} aria-pressed={decisions[key] === 'accepted'} onClick={() => onDecision(key, 'accepted')}>Принять</button><button type="button" aria-label={`Отклонить изменение «${label}»`} aria-pressed={decisions[key] === 'rejected'} onClick={() => onDecision(key, 'rejected')}>Отклонить</button></div></div></article>)}</div>}</section>;
}
export function AdminEditorPage({ id }: {
    id: string;
}) {
    const storageKey = `skuf-admin-draft:${id}`;
    const [item, setItem] = useState<AdminContent | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [reason, setReason] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [decisions, setDecisions] = useState<Partial<Record<keyof Original, Decision>>>({});
    const goToLogin = (currentDraft?: Draft | null) => {
        if (currentDraft)
            sessionStorage.setItem(storageKey, JSON.stringify(currentDraft));
        sessionStorage.removeItem('skuf-admin-csrf');
        window.location.hash = '#/admin/login';
    };
    useEffect(() => {
        void adminRequest<AdminContent>(`/api/admin/content/${id}`).then(({ response, data }) => {
            if (response.status === 401) {
                goToLogin();
                return;
            }
            if (!response.ok || !data)
                throw new Error('load failed');
            const saved = sessionStorage.getItem(storageKey);
            setItem(data);
            setDraft(saved ? JSON.parse(saved) as Draft : { type: data.type, title: data.title, explanation: data.explanation, example: data.example, tags: data.tags, ...(data.context ? { context: data.context } : {}), ...(data.origin ? { origin: data.origin } : {}), ...(data.author ? { author: data.author } : {}), ...(data.media ? { media: data.media } : {}) });
        }).catch(() => setError('Не удалось загрузить карточку.'));
    }, [id]);
    const request = async (path: string, init: RequestInit, success: string) => {
        setError('');
        setMessage('');
        const { response, data } = await adminRequest<AdminContent & {
            error?: string;
            current?: AdminContent;
        }>(path, init);
        if (response.status === 401) {
            goToLogin(draft);
            return;
        }
        if (response.status === 409) {
            setError('Карточка уже изменена в другой вкладке. Обновите страницу.');
            return;
        }
        if (!response.ok || !data) {
            setError(data?.error ?? 'Не удалось выполнить действие.');
            return;
        }
        setItem(data);
        setMessage(success);
        sessionStorage.removeItem(storageKey);
    };
    const save = (event: FormEvent) => { event.preventDefault(); if (item && draft)
        void request(`/api/admin/content/${id}`, { method: 'PATCH', body: JSON.stringify({ version: item.version, draft: { ...draft, ...(item.correction ? { correction: item.correction } : {}) } }) }, 'Изменения сохранены'); };
    const transition = (action: 'publish' | 'reject' | 'unpublish') => { if (item)
        void request(`/api/admin/content/${id}/${action}`, { method: 'POST', body: JSON.stringify({ version: item.version, ...(action !== 'publish' ? { reason } : {}) }) }, action === 'publish' ? 'Карточка опубликована' : action === 'reject' ? 'Карточка отклонена' : 'Карточка снята с публикации'); };
    const remove = async () => { if (!item)
        return; const { response } = await adminRequest(`/api/admin/content/${id}`, { method: 'DELETE', body: JSON.stringify({ version: item.version }) }); if (response.status === 401)
        return goToLogin(draft); if (response.ok)
        window.location.hash = '#/admin';
    else
        setError('Не удалось удалить карточку.'); };
    if (!item || !draft)
        return <section className="admin-page"><p role="status">{error || 'Загружаем карточку…'}</p></section>;
    const field = <K extends keyof Draft>(name: K, value: Draft[K]) => {
        setDraft({ ...draft, [name]: value });
        setDecisions((current) => {
            const next = { ...current };
            delete next[name as keyof Original];
            return next;
        });
    };
    const decide = (key: keyof Original, decision: Decision) => {
        const original = item.correction?.original ?? (item.correction ? legacyOriginals[item.correction.targetSlug] : undefined);
        if (!original)
            return;
        const value = decision === 'accepted' ? item[key] : original[key];
        setDraft({ ...draft, [key]: value });
        setDecisions({ ...decisions, [key]: decision });
    };
    let videoPreview = '';
    if (draft.media?.kind === 'video') {
        try {
            videoPreview = parseExternalVideoUrl(draft.media.url).embedUrl;
        }
        catch {
            videoPreview = '';
        }
    }
    return <section className="admin-page">
        <a className="term-detail__back" href="#/admin">← Назад в очередь</a>
        <p className="eyebrow"><span /> {item.status}</p>
        <h1>Редактирование карточки</h1>
        <CorrectionComparison item={item} decisions={decisions} onDecision={decide}/>
        <form className="admin-editor" onSubmit={save}>
            <label>Название<input value={draft.title} onChange={(event) => field('title', event.target.value)} required maxLength={100}/></label>
            <label className="admin-editor__wide">Объяснение<textarea value={draft.explanation} onChange={(event) => field('explanation', event.target.value)} required rows={5}/></label>
            <label>Пример<textarea value={draft.example} onChange={(event) => field('example', event.target.value)} required rows={4}/></label>
            {draft.type === 'term' && <label>Контекст<textarea value={draft.context ?? ''} onChange={(event) => field('context', event.target.value)} required rows={4}/></label>}
            {draft.type === 'meme' && <>
                <label>Происхождение<textarea value={draft.origin ?? ''} onChange={(event) => field('origin', event.target.value)} required rows={4}/></label>
                <label>Ссылка на видео<input type="url" value={draft.media?.kind === 'video' ? draft.media.url : ''} onChange={(event) => field('media', { kind: 'video', url: event.target.value })} required maxLength={2048}/></label>
                {videoPreview ? <div className="new-card-preview admin-editor__wide"><iframe src={videoPreview} title="Превью видео мема" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen/></div> : <p className="form-status form-status--error admin-editor__wide" role="alert">Поддерживаются только корректные HTTPS-ссылки RuTube и YouTube.</p>}
            </>}
            <label className="admin-editor__wide">Теги через запятую<input value={draft.tags.join(', ')} onChange={(event) => field('tags', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))}/></label>
            <button className="button button--dark" type="submit">Сохранить изменения</button>
        </form>
        <div className="admin-actions">
            {(item.status === 'pending' || item.status === 'unpublished') && <button className="button button--dark" type="button" onClick={() => transition('publish')}>Опубликовать</button>}
            {item.status === 'pending' && <><label>Причина отклонения<input value={reason} onChange={(event) => setReason(event.target.value)}/></label><button className="button" type="button" disabled={!reason.trim()} onClick={() => transition('reject')}>Отклонить</button></>}
            {item.status === 'published' && <><label>Причина снятия<input value={reason} onChange={(event) => setReason(event.target.value)}/></label><button className="button" type="button" disabled={!reason.trim()} onClick={() => transition('unpublish')}>Снять с публикации</button><DeleteConfirmation onConfirm={remove}/></>}
        </div>
        {message && <p className="form-status form-status--success" role="status">{message}</p>}
        {error && <p className="form-status form-status--error" role="alert">{error}</p>}
    </section>;
}
