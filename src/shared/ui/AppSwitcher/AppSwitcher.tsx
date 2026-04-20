import { useState, useRef, useEffect } from 'react'
import { APPS, CURRENT_APP_ID } from './apps'
import styles from './AppSwitcher.module.scss'

/** Переключатель между сайтами экосистемы PW Hub */
export function AppSwitcher() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [])

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Переключить приложение"
        aria-expanded={open}
      >
        <span className={styles.grid} aria-hidden="true">
          <span /><span /><span />
          <span /><span /><span />
          <span /><span /><span />
        </span>
      </button>
      {open && (
        <div className={styles.popover} role="menu">
          <div className={styles.popoverHeader}>Экосистема PW Hub</div>
          <div className={styles.apps}>
            {APPS.map((app) => {
              const current = app.id === CURRENT_APP_ID
              return (
                <a
                  key={app.id}
                  href={app.url}
                  className={`${styles.app} ${current ? styles.appCurrent : ''}`}
                  rel="noopener"
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  <span
                    className={styles.appIcon}
                    style={{ background: app.color }}
                    aria-hidden="true"
                  >
                    {app.iconSrc ? (
                      <img src={app.iconSrc} alt="" className={styles.appIconImg} />
                    ) : (
                      app.icon
                    )}
                  </span>
                  <span className={styles.appBody}>
                    <span className={styles.appTitle}>
                      {app.title}
                      {current && <span className={styles.badge}>здесь</span>}
                    </span>
                    <span className={styles.appDesc}>{app.description}</span>
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
