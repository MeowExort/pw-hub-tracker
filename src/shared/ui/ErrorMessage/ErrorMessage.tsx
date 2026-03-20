import styles from './ErrorMessage.module.scss'

/** Пропсы компонента ошибки */
interface ErrorMessageProps {
  /** Текст ошибки */
  message: string
  /** Обработчик повторной попытки */
  onRetry?: () => void
}

/** Сообщение об ошибке с кнопкой повтора */
export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className={styles.error}>
      <p className={styles.text}>{message}</p>
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  )
}
