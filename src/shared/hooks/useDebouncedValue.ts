import { useEffect, useState } from 'react'

/**
 * Возвращает значение, обновляющееся только после того, как пользователь
 * перестал его изменять в течение `delay` мс. Используется для фильтров
 * поиска, чтобы не делать запрос на каждое нажатие клавиши.
 */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebounced(value)
    }, delay)

    return () => {
      clearTimeout(handle)
    }
  }, [value, delay])

  return debounced
}

export default useDebouncedValue
