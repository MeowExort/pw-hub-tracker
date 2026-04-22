import {
  forwardRef,
  useRef,
  useImperativeHandle,
  type ChangeEvent,
  type InputHTMLAttributes,
} from 'react'

/**
 * Числовой инпут с визуальным разделением разрядов пробелами.
 *
 * Рендерит нативный `<input type="text" inputMode="numeric">`, чтобы иметь
 * возможность отображать значение с разделителями (type="number" не
 * поддерживает символы-нецифры).
 *
 * API совместим с нативным `<input type="number">`:
 *  - `value` — строка или число (как и было);
 *  - в `onChange` прокидывается синтетическое событие, в котором
 *    `e.target.value` содержит ЧИСТУЮ строку без пробелов/разделителей
 *    (как и у обычного `type="number"`), чтобы не ломать вызывающий код.
 */
export interface NumberInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value?: string | number | null
  /** Разрешать ли отрицательные значения. По умолчанию true. */
  allowNegative?: boolean
  /** Разрешать ли дробные значения. По умолчанию false. */
  allowDecimal?: boolean
  /** Разделитель разрядов. По умолчанию — неразрывный пробел. */
  thousandsSeparator?: string
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
}

/** Форматирует чистую числовую строку с разделителями разрядов. */
export function formatNumberString(
  raw: string,
  separator: string = '\u00A0',
  allowDecimal: boolean = false,
): string {
  if (raw === '' || raw === '-') return raw
  const negative = raw.startsWith('-')
  let body = negative ? raw.slice(1) : raw
  let fraction = ''
  if (allowDecimal) {
    const dotIdx = body.indexOf('.')
    if (dotIdx !== -1) {
      fraction = body.slice(dotIdx) // включая точку
      body = body.slice(0, dotIdx)
    }
  }
  const intPart = body.replace(/^0+(?=\d)/, '') // убрать ведущие нули (но оставить одиночный)
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
  return `${negative ? '-' : ''}${grouped || (body === '' ? '' : '0')}${fraction}`
}

/** Санитизирует ввод — оставляет только цифры (и, опционально, минус/точку). */
function sanitize(input: string, allowNegative: boolean, allowDecimal: boolean): string {
  let s = input
  // Удаляем все пробелы (включая неразрывные) и любые другие разделители.
  s = s.replace(/[\s\u00A0,]/g, '')
  if (allowDecimal) s = s.replace(/,/g, '.')
  let negative = false
  if (allowNegative && s.startsWith('-')) negative = true
  s = s.replace(/-/g, '')
  if (allowDecimal) {
    // Оставляем только первую точку.
    const firstDot = s.indexOf('.')
    if (firstDot !== -1) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
    }
    s = s.replace(/[^\d.]/g, '')
  } else {
    s = s.replace(/\D/g, '')
  }
  return (negative ? '-' : '') + s
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      value,
      onChange,
      allowNegative = true,
      allowDecimal = false,
      thousandsSeparator = '\u00A0',
      inputMode,
      ...rest
    },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, [])

    const stringValue =
      value === null || value === undefined ? '' : String(value)
    const displayValue = formatNumberString(stringValue, thousandsSeparator, allowDecimal)

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return
      const clean = sanitize(e.target.value, allowNegative, allowDecimal)
      // Отдаём наружу исходный event, но с «чистой» строкой в target/currentTarget.value.
      // Обёртка через прокси, чтобы не мутировать DOM-узел.
      const wrapTarget = (t: EventTarget & HTMLInputElement) =>
        new Proxy(t, {
          get(tg, p: string | symbol) {
            if (p === 'value') return clean
            const v = (tg as unknown as Record<string | symbol, unknown>)[p]
            return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(tg) : v
          },
        })
      const proxied = new Proxy(e, {
        get(target, p: string | symbol) {
          if (p === 'target' || p === 'currentTarget') return wrapTarget(target.target)
          const v = (target as unknown as Record<string | symbol, unknown>)[p]
          return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
        },
      }) as ChangeEvent<HTMLInputElement>
      onChange(proxied)
    }

    return (
      <input
        {...rest}
        ref={innerRef}
        type="text"
        inputMode={inputMode ?? (allowDecimal ? 'decimal' : 'numeric')}
        value={displayValue}
        onChange={handleChange}
      />
    )
  },
)
