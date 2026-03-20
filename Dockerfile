# Этап 1: Сборка фронтенда
FROM node:20-alpine AS build

WORKDIR /app

# Устанавливаем pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Копируем файлы зависимостей
COPY package.json pnpm-lock.yaml ./

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Копируем исходный код
COPY . .

# URL API-сервера (можно переопределить при сборке)
ARG VITE_API_URL=https://api.tracker.pw-hub.ru
ENV VITE_API_URL=${VITE_API_URL}

# Собираем фронтенд
RUN pnpm build

# Этап 2: Nginx для раздачи статики
FROM nginx:alpine AS production

# Копируем конфиг nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранный фронтенд
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
