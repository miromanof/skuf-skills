# Бесплатное облачное размещение

Публичный React-сайт остаётся на GitHub Pages, а `api.skufskills.ru` работает в Cloudflare Worker и хранит очередь, публикации и администраторские сессии в D1. Компьютер владельца для работы сайта не нужен.

## Что создать в Cloudflare Free

1. Добавить зону `skufskills.ru` на бесплатном тарифе, не подключая платные дополнения.
2. До смены NS скопировать текущие записи GitHub Pages:
   - `A @ 185.199.108.153`
   - `A @ 185.199.109.153`
   - `A @ 185.199.110.153`
   - `A @ 185.199.111.153`
   - `CNAME www miromanof.github.io`
3. Создать D1 с именем `skuf-skills-production` и записать выданный UUID.
4. После первого деплоя убедиться, что custom domain Worker — `api.skufskills.ru`, а apex по-прежнему ведёт на GitHub Pages.

Перед сменой NS проверить записи через публичные резолверы. В REG.RU заменить только авторитетные NS на выданные Cloudflare. Старую DNS-зону REG.RU не удалять до завершения распространения и проверки TLS.

## GitHub Actions

В Settings → Secrets and variables → Actions добавить repository secrets:

- `CLOUDFLARE_API_TOKEN` — ограниченный токен с правами Workers Scripts Edit, D1 Edit и Zone DNS Edit только для нужного аккаунта/зоны;
- `CLOUDFLARE_ACCOUNT_ID` — ID аккаунта Cloudflare;
- `CLOUDFLARE_D1_DATABASE_ID` — UUID созданной D1.

Администраторские секреты Worker задаются локальной командой `npm run cloudflare:admin-setup`; открытый пароль в GitHub или репозиторий не попадает. После этого запуск workflow Pages сначала тестирует, мигрирует и публикует API, проверяет `/health`, и только затем собирает сайт с `VITE_API_BASE_URL=https://api.skufskills.ru`.

## Проверка до переключения DNS

- `npm run check:cloud-deployment`
- `npm test`
- `npm run typecheck`
- `npm run build`
- проверить `https://api.skufskills.ru/health` после деплоя;
- проверить `https://skufskills.ru` и `https://www.skufskills.ru` после распространения NS.

Если Worker не прошёл проверку, Pages не публикуется и предыдущая рабочая версия остаётся доступной. Для отката повторно запустить успешный commit либо вернуть предыдущий commit и запустить workflow вручную.

## Резервная копия D1

Экспорт хранить локально вне Git и не добавлять в репозиторий:

```powershell
npx wrangler d1 export skuf-skills-production --remote --output .data/backups/skuf-skills-production.sql --config apps/worker/wrangler.jsonc
```

После экспорта проверить, что SQL содержит таблицы `content_items`, `admin_sessions` и `rate_limits`. Для регулярной сохранности достаточно делать экспорт перед изменением схемы и после крупных серий публикаций.
