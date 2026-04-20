/**
 * Таблица маршрутизации клиента: какой path-template/method соответствует
 * какому обфусцированному идентификатору действия.
 *
 * Никаких читаемых имён действий (`getMarketSummary`, `searchTeams` …) на
 * клиенте нет — они остаются только в `vite.config.ts` во время сборки и в
 * BFF-сервере (в его приватной области). В бандл попадает только массив
 * `[method, pathTemplate, actionHash, isSearch]`.
 */

/** Единица маршрутизации: HTTP-метод, шаблон пути, хеш действия, признак поиска. */
export interface RouteEntry {
  method: string
  path: string
  actionId: string
  search: boolean
}

/**
 * Массив маршрутов, подставляется Vite define при сборке.
 * Порядок: `[method, path, actionId, isSearch]`.
 */
const RAW_ROUTES: Array<[string, string, string, boolean]> =
  __ACTION_MAP__ as unknown as Array<[string, string, string, boolean]>

const ROUTES: RouteEntry[] = RAW_ROUTES.map(([method, path, actionId, search]) => ({
  method,
  path,
  actionId,
  search: !!search,
}))

/** Возвращает все зарегистрированные маршруты (read-only). */
export function getRoutes(): ReadonlyArray<RouteEntry> {
  return ROUTES
}

/**
 * Сопоставляет реальный путь с шаблоном маршрута,
 * возвращает `{ actionId, params, search }` или `null`, если маршрут не найден.
 */
export function resolveRoute(
  method: string,
  actualPath: string,
): { actionId: string; pathParams: Record<string, string>; search: boolean } | null {
  const upper = method.toUpperCase()
  for (const route of ROUTES) {
    if (route.method !== upper) continue
    const params = matchPath(route.path, actualPath)
    if (params !== null) {
      return { actionId: route.actionId, pathParams: params, search: route.search }
    }
  }
  return null
}

/** Простое сопоставление шаблона с `:param` и конкретного path. */
function matchPath(template: string, actual: string): Record<string, string> | null {
  const t = template.split('/')
  const a = actual.split('/')
  if (t.length !== a.length) return null
  const out: Record<string, string> = {}
  for (let i = 0; i < t.length; i++) {
    if (t[i].startsWith(':')) {
      out[t[i].slice(1)] = decodeURIComponent(a[i])
    } else if (t[i] !== a[i]) {
      return null
    }
  }
  return out
}
