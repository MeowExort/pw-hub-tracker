import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import styles from './NavDropdown.module.scss'

export interface NavDropdownItem {
  to: string
  label: string
}

interface NavDropdownProps {
  label: string
  items: NavDropdownItem[]
}

/** Переиспользуемый dropdown для навигации */
export function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const isActive = items.some((item) => location.pathname.startsWith(item.to))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div
      className={styles.dropdown}
      ref={ref}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={`${styles.trigger} ${isActive ? styles.triggerActive : ''}`}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {label}
      </button>
      {open && (
        <div className={styles.menu}>
          <div className={styles.menuInner}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive: active }) =>
                `${styles.menuItem} ${active ? styles.menuItemActive : ''}`
              }
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          </div>
        </div>
      )}
    </div>
  )
}
