import styles from './Spinner.module.scss'

/** Пропсы спиннера */
interface SpinnerProps {
  /** Размер спиннера */
  size?: 'sm' | 'md' | 'lg'
}

/** Индикатор загрузки */
export function Spinner({ size = 'md' }: SpinnerProps) {
  return <div className={`${styles.spinner} ${styles[size]}`} role="status" aria-label="Загрузка" />
}
