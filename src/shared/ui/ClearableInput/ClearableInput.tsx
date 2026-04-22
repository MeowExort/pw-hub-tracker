import { forwardRef, useRef, useImperativeHandle, type InputHTMLAttributes, type ChangeEvent } from 'react'
import styles from './ClearableInput.module.scss'
import { formatNumberString } from '../NumberInput/NumberInput'

export interface ClearableInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Кастомный обработчик очистки. По умолчанию — синтетический onChange с пустой строкой. */
  onClear?: () => void
  /** Класс на обёртке (не на инпуте). */
  wrapperClassName?: string
}

/**
 * Текстовый `<input>` с ненавязчивой кнопкой очистки (×).
 * Кнопка появляется только если в поле есть значение.
 * Стиль кнопки согласован с дизайн-системой (использует CSS-переменные темы).
 */
export const ClearableInput = forwardRef<HTMLInputElement, ClearableInputProps>(
  function ClearableInput(
    { onClear, wrapperClassName, className, type, value, defaultValue, onChange, disabled, readOnly, inputMode, ...rest },
    ref,
  ) {
    const innerRef = useRef<HTMLInputElement>(null)
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement, [])

    const isNumeric = type === 'number'
    const currentValue = value ?? innerRef.current?.value ?? ''
    const hasValue = currentValue !== '' && currentValue !== null && currentValue !== undefined
    const canClear = hasValue && !disabled && !readOnly

    // Для числового режима: отображаем с разделителями разрядов,
    // но в onChange отдаём чистую числовую строку (как у type="number").
    const displayValue = isNumeric
      ? formatNumberString(value === null || value === undefined ? '' : String(value))
      : (value as InputHTMLAttributes<HTMLInputElement>['value'])

    const handleNumericChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return
      const raw = e.target.value.replace(/[\s\u00A0,]/g, '')
      const negative = raw.startsWith('-')
      const digits = raw.replace(/\D/g, '')
      const clean = (negative ? '-' : '') + digits
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

    const handleClear = () => {
      if (onClear) {
        onClear()
      } else if (onChange && innerRef.current) {
        // Имитируем нативный onChange с пустой строкой.
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        setter?.call(innerRef.current, '')
        const event = new Event('input', { bubbles: true })
        innerRef.current.dispatchEvent(event)
      }
      innerRef.current?.focus()
    }

    return (
      <span className={`${styles.wrapper} ${wrapperClassName ?? ''}`.trim()}>
        <input
          {...rest}
          ref={innerRef}
          type={isNumeric ? 'text' : type}
          inputMode={isNumeric ? (inputMode ?? 'numeric') : inputMode}
          value={isNumeric ? (displayValue as string) : value}
          defaultValue={defaultValue}
          onChange={isNumeric ? handleNumericChange : onChange}
          disabled={disabled}
          readOnly={readOnly}
          className={`${className ?? ''} ${styles.input}`.trim()}
        />
        {canClear && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            aria-label="Очистить"
            tabIndex={-1}
          >
            <svg
              className={styles.icon}
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M2 2 L10 10 M10 2 L2 10" />
            </svg>
          </button>
        )}
      </span>
    )
  },
)
