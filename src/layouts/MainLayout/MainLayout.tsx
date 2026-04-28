import {NavLink, Outlet} from 'react-router-dom'
import { NavDropdown } from '@/shared/ui/NavDropdown'
import { AppSwitcher, APPS, CURRENT_APP_ID } from '@/shared/ui/AppSwitcher'
import styles from './MainLayout.module.scss'

/** Основной лейаут приложения с навигацией */
export function MainLayout() {
    let dev = !!localStorage.getItem('dev');
    return (
        <div className={styles.layout}>
            <header className={styles.header}>
                <div className={styles.container}>
                    <AppSwitcher />
                    <NavLink to="/" className={styles.logo}>
                        <img src="/icon.svg" alt="" className={styles.logoIcon} />
                        Tracker
                    </NavLink>
                    <nav className={styles.nav}>
                        <NavDropdown
                            label="Арена"
                            items={[
                                { to: '/teams', label: 'Команды' },
                                { to: '/matches', label: 'Матчи' },
                                { to: '/arena/live', label: 'Сейчас аренят' },
                            ]}
                        />
                        <NavLink
                            to="/players"
                            className={({isActive}) => `${styles.link} ${isActive ? styles.active : ''}`}
                        >
                            Игроки
                        </NavLink>
                        <NavDropdown
                            label="Кланы"
                            items={[
                                { to: '/clan-compare', label: 'Aura vs Eternals' },
                                { to: '/centaur-clan-compare', label: 'Ermitage vs exchange' },
                                { to: '/mizar-clan-compare', label: 'VoidBorn vs Improve' },
                            ]}
                        />
                        <NavDropdown
                            label="Рынок"
                            items={[
                                { to: '/market', label: 'Дашборд' },
                                { to: '/collections', label: 'Подборки' },
                                { to: '/shops', label: 'Магазины' },
                                { to: '/items', label: 'Предметы' },
                                { to: '/alerts', label: 'Алерты' },
                                { to: '/trades', label: 'Аналитика сделок' },
                                { to: '/bots', label: 'Детектор ботов' },
                            ]}
                        />
                        {
                            dev && <>
                                <NavLink
                                    to="/analytics/classes"
                                    className={({isActive}) => `${styles.link} ${isActive ? styles.active : ''}`}
                                >
                                    Аналитика - Классы
                                </NavLink>
                                <NavLink
                                    to="/analytics/players"
                                    className={({isActive}) => `${styles.link} ${isActive ? styles.active : ''}`}
                                >
                                    Аналитика - Игроки
                                </NavLink>
                                <NavLink
                                    to="/analytics/time"
                                    className={({isActive}) => `${styles.link} ${isActive ? styles.active : ''}`}
                                >
                                    Аналитика - Время
                                </NavLink>
                                <NavLink
                                    to="/analytics/servers"
                                    className={({isActive}) => `${styles.link} ${isActive ? styles.active : ''}`}
                                >
                                    Аналитика - Серверы
                                </NavLink>
                            </>
                        }
                    </nav>
                </div>
            </header>
            <main className={styles.main}>
                <div className={styles.container}>
                    <Outlet/>
                </div>
            </main>
            <footer className={styles.footer}>
                <div className={styles.container}>
                    <div className={styles.footerHead}>
                        <div className={styles.footerBrand}>PW Hub</div>
                        <div className={styles.footerTagline}>
                            Единая экосистема инструментов для Perfect World
                        </div>
                    </div>
                    <div className={styles.footerApps}>
                        {APPS.map((app) => {
                            const current = app.id === CURRENT_APP_ID
                            return (
                                <a
                                    key={app.id}
                                    href={app.url}
                                    rel="noopener"
                                    className={`${styles.footerApp} ${current ? styles.footerAppCurrent : ''}`}
                                >
                                    <span
                                        className={styles.footerAppIcon}
                                        style={{ background: app.color }}
                                        aria-hidden="true"
                                    >
                                        {app.iconSrc ? (
                                            <img src={app.iconSrc} alt="" className={styles.footerAppIconImg} />
                                        ) : (
                                            app.icon
                                        )}
                                    </span>
                                    <span className={styles.footerAppBody}>
                                        <span className={styles.footerAppTitle}>
                                            {app.title}
                                            {current && <span className={styles.footerBadge}>здесь</span>}
                                        </span>
                                        <span className={styles.footerAppDesc}>{app.description}</span>
                                    </span>
                                </a>
                            )
                        })}
                    </div>
                    <div className={styles.footerCopy}>
                        © {new Date().getFullYear()} PW Hub
                    </div>
                </div>
            </footer>
        </div>
    )
}
