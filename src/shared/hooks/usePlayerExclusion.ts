import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

const LS_PREFIX = 'pw-hub-excluded-'

/** Кодирует массив ID в компактную строку для URL */
function encodeIds(ids: number[]): string {
  return ids.sort((a, b) => a - b).join(',')
}

/** Декодирует строку обратно в Set ID */
function decodeIds(str: string): Set<number> {
  if (!str) return new Set()
  return new Set(str.split(',').map(Number).filter((n) => !isNaN(n)))
}

/**
 * Хук для управления исключением игроков из расчёта.
 * Сохраняет состояние в localStorage и поддерживает шаринг через URL-параметр.
 *
 * @param pageKey — уникальный ключ страницы (например, 'clan-compare')
 * @param allPlayerIds — все ID игроков на странице
 */
export function usePlayerExclusion(pageKey: string, allPlayerIds: number[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const lsKey = LS_PREFIX + pageKey

  // Инициализация: приоритет URL > localStorage
  const [excludedIds, setExcludedIds] = useState<Set<number>>(() => {
    const urlParam = searchParams.get('excluded')
    if (urlParam !== null) {
      return decodeIds(urlParam)
    }
    try {
      const stored = localStorage.getItem(lsKey)
      if (stored) return decodeIds(stored)
    } catch { /* ignore */ }
    return new Set()
  })

  // Очистить URL-параметр после инициализации, чтобы не мешал дальнейшей навигации
  useEffect(() => {
    if (searchParams.has('excluded')) {
      const next = new URLSearchParams(searchParams)
      next.delete('excluded')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Сохранять в localStorage при изменении
  useEffect(() => {
    try {
      if (excludedIds.size === 0) {
        localStorage.removeItem(lsKey)
      } else {
        localStorage.setItem(lsKey, encodeIds([...excludedIds]))
      }
    } catch { /* ignore */ }
  }, [excludedIds, lsKey])

  const togglePlayer = useCallback((id: number) => {
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const isExcluded = useCallback((id: number) => excludedIds.has(id), [excludedIds])

  const excludeAll = useCallback(() => {
    setExcludedIds(new Set(allPlayerIds))
  }, [allPlayerIds])

  const includeAll = useCallback(() => {
    setExcludedIds(new Set())
  }, [])

  /** Генерирует ссылку для шаринга текущего набора исключений */
  const getShareUrl = useCallback(() => {
    const url = new URL(window.location.href)
    if (excludedIds.size > 0) {
      url.searchParams.set('excluded', encodeIds([...excludedIds]))
    } else {
      url.searchParams.delete('excluded')
    }
    return url.toString()
  }, [excludedIds])

  const activeCount = useMemo(
    () => allPlayerIds.filter((id) => !excludedIds.has(id)).length,
    [allPlayerIds, excludedIds],
  )

  return {
    excludedIds,
    togglePlayer,
    isExcluded,
    excludeAll,
    includeAll,
    getShareUrl,
    activeCount,
  }
}
