/// <reference types="vite/client" />

/** Секрет HMAC-подписи запросов к BFF-прокси (инжектится Vite при сборке). */
declare const __SIGNING_SECRET__: string

/** Соль, использованная для генерации хешей действий (инжектится Vite при сборке). */
declare const __BUILD_SALT__: string

/** Массив маршрутов `[method, pathTemplate, actionHash, isSearch]` (инжектится Vite при сборке). */
declare const __ACTION_MAP__: Array<[string, string, string, boolean]>

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_HCAPTCHA_SITE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
