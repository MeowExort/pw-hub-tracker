# PW Hub Tracker — BFF-сервер

Backend-for-Frontend, закрывающий публичный API трекера защитой от парсинга.

## Что делает

- Раздаёт статику из `dist/`.
- Единая точка `POST /api/proxy` для всех запросов к API:
  - проверка HMAC-SHA256 подписи (с fingerprint, nonce, timestamp ±30 сек);
  - обязательный Proof-of-Work (challenge выдаётся `GET /api/pow-challenge`, сложность 3 нуля SHA-256);
  - rate limiting: IP 60/мин, FP 100/мин, «поисковые» 20/мин, burst 10/сек, прогрессивное замедление 0.8–1.0;
  - эскалация на CAPTCHA (hCaptcha) при подозрении;
  - проксирование на реальный API с приватным `X-Api-Key`.

Имена действий, `API_TARGET` и `X-Api-Key` никогда не попадают в клиентский бандл.

## Переменные окружения

| Переменная         | Обязательная | По умолчанию                        | Назначение                            |
|--------------------|--------------|-------------------------------------|---------------------------------------|
| `PORT`             | нет          | `3000`                              | порт HTTP                             |
| `API_TARGET`       | да           | `https://api.tracker.pw-hub.ru`     | адрес реального API                   |
| `API_KEY`          | да           | —                                   | ключ API (отправляется как `X-Api-Key`) |
| `HCAPTCHA_SECRET`  | нет          | —                                   | секрет hCaptcha; без него CAPTCHA просто требуется клиенту, но не проверяется |
| `SITE_URL`         | нет          | `https://tracker.pw-hub.ru`         | используется в логах/OG               |
| `BUILD_SALT`       | да           | читается из `dist/.build-env`       | соль хеша действий                    |
| `SIGNING_SECRET`   | да           | читается из `dist/.build-env`       | секрет HMAC-подписи запросов          |

`BUILD_SALT` и `SIGNING_SECRET` **должны совпадать** со значениями, которые
Vite использовал при сборке фронтенда (см. `vite.config.ts`).

## Запуск локально

```powershell
# 1. собираем фронтенд (создаст dist/.build-env)
pnpm build

# 2. ставим BFF-зависимости
cd server
npm install --omit=dev

# 3. запускаем BFF
$env:API_TARGET = "https://api.tracker.pw-hub.ru"
$env:API_KEY = "…"
node index.js
```

Откройте http://localhost:3000 — фронтенд будет обращаться к `/api/proxy` и
`/api/pow-challenge` того же хоста.

## Dev-режим (vite dev + BFF)

```powershell
# в одном терминале
cd server; node index.js   # слушает 3000

# в другом
pnpm dev                   # vite dev proxy-ит /api/proxy и /api/pow-challenge на :3000
```

## Docker

```bash
docker build \
  --build-arg BUILD_SALT=$(openssl rand -hex 8) \
  --build-arg SIGNING_SECRET=$(openssl rand -hex 32) \
  -t pw-hub-tracker .

docker run -p 3000:3000 \
  -e API_TARGET=https://api.tracker.pw-hub.ru \
  -e API_KEY=... \
  -e HCAPTCHA_SECRET=... \
  pw-hub-tracker
```

## Nginx перед BFF

Важно включить доверие к X-Forwarded-For:

```nginx
location / {
    proxy_pass http://tracker-bff:3000;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
}
```

BFF уже настроен с `app.set('trust proxy', true)`.
