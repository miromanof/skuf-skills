import { useState, type FormEvent } from 'react';
import { adminRequest } from '../../shared/api/client.js';

export function AdminLoginPage() {
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true);
    setError('');
    const values = new FormData(form);
    try {
      const { response, data } = await adminRequest<{ authenticated?: boolean; csrfToken?: string }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ login: String(values.get('login') ?? ''), password: String(values.get('password') ?? '') }),
      });
      if (!response.ok || !data?.csrfToken) throw new Error('login failed');
      sessionStorage.setItem('skuf-admin-csrf', data.csrfToken);
      form.reset();
      window.location.hash = '#/admin';
    } catch {
      setError('Неверный логин или пароль');
    } finally {
      setSending(false);
    }
  };

  return <section className="admin-page admin-login"><p className="eyebrow"><span /> Только для редакции</p><h1>Вход администратора</h1><form className="admin-login__form" onSubmit={submit}><label>Логин<input name="login" type="email" autoComplete="username" required /></label><label>Пароль<input name="password" type="password" autoComplete="current-password" required /></label><button className="button button--dark" type="submit" disabled={sending}>{sending ? 'Проверяем…' : 'Войти'}</button>{error && <p className="form-status form-status--error" role="alert">{error}</p>}</form></section>;
}
