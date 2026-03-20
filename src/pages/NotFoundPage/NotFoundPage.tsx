import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.scss'

/** Страница 404 */
export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.code}>404</h1>
      <p className={styles.text}>Страница не найдена</p>
      <Link to="/" className={styles.link}>На главную</Link>
    </div>
  )
}
