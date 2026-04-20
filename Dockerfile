# Этап 1: Сборка фронтенда
FROM node:20-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Секреты сборки (передаются через --build-arg)
ARG BUILD_SALT
ARG SIGNING_SECRET
ENV BUILD_SALT=${BUILD_SALT}
ENV SIGNING_SECRET=${SIGNING_SECRET}

RUN pnpm build

# Этап 2: Production BFF-сервер
FROM node:20-alpine AS production
WORKDIR /app

# Зависимости BFF
COPY server/package.json ./package.json
RUN npm install --omit=dev

# Код BFF
COPY server/index.js ./index.js

# Собранный фронтенд (включая dist/.build-env)
COPY --from=build /app/dist ./dist

ENV PORT=3000
ENV API_TARGET=https://api.tracker.pw-hub.ru
ENV SITE_URL=https://tracker.pw-hub.ru
ENV HCAPTCHA_SECRET=""
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/pow-challenge || exit 1

CMD ["node", "index.js"]
