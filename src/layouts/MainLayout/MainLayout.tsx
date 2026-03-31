import { NavLink, Outlet } from 'react-router-dom'
import styles from './MainLayout.module.scss'

/** Основной лейаут приложения с навигацией */
export function MainLayout() {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.container}>
          <NavLink to="/" className={styles.logo}>
            ⚔️ Arena Tracker
          </NavLink>
          <nav className={styles.nav}>
            <NavLink
              to="/teams"
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Команды
            </NavLink>
            <NavLink
              to="/matches"
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Матчи
            </NavLink>
            <NavLink
                to="/clan-compare"
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Aura vs Eternals
            </NavLink>
            <NavLink
                to="/centaur-clan-compare"
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Ermitage vs exchange
            </NavLink>
            <NavLink
                to="/analytics/classes"
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Классы
            </NavLink>
            <NavLink
                to="/analytics/players"
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Игроки
            </NavLink>
            <NavLink
                to="/analytics/time"
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Время
            </NavLink>
            <NavLink
                to="/analytics/servers"
                className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              Серверы
            </NavLink>
          </nav>
        </div>
      </header>
      <main className={styles.main}>
        <div className={styles.container}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
