import { useEffect, useState } from 'react'
import type { Collection } from '@/shared/collections'
import styles from './CollectionsPage.module.scss'

export interface CollectionsSidebarProps {
  collections: Collection[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  onEdit: (c: Collection) => void
  onDuplicate: (c: Collection) => void
  onDelete: (c: Collection) => void
  onResetDefaults: () => void
  onShare: (c: Collection) => void
  onImport: () => void
}

/** Sidebar со списком подборок, счётчиком позиций и контекстным меню. */
export function CollectionsSidebar({
  collections,
  activeId,
  onSelect,
  onCreate,
  onEdit,
  onDuplicate,
  onDelete,
  onResetDefaults,
  onShare,
  onImport,
}: CollectionsSidebarProps) {
  const [menuForId, setMenuForId] = useState<string | null>(null)

  useEffect(() => {
    if (menuForId == null) return
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest(`.${styles.sidebarMenu}`) || target.closest(`.${styles.sidebarMenuBtn}`)) return
      setMenuForId(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuForId])

  const defaults = collections.filter((c) => c.isDefault)
  const custom = collections.filter((c) => !c.isDefault)

  const renderItem = (c: Collection) => {
    const active = c.id === activeId
    return (
      <div
        key={c.id}
        className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ''}`}
        onClick={() => onSelect(c.id)}
        style={c.color ? { borderLeftColor: c.color } : undefined}
      >
        <span className={styles.sidebarIcon}>{c.icon ?? '📦'}</span>
        <span className={styles.sidebarName}>{c.name}</span>
        <span className={styles.sidebarCount}>{c.items.length}</span>
        <button
          type="button"
          className={styles.sidebarMenuBtn}
          onClick={(e) => {
            e.stopPropagation()
            setMenuForId(menuForId === c.id ? null : c.id)
          }}
          aria-label="Меню подборки"
        >
          ⋮
        </button>
        {menuForId === c.id && (
          <div className={styles.sidebarMenu} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { setMenuForId(null); onEdit(c) }}>✏️ Переименовать</button>
            <button onClick={() => { setMenuForId(null); onDuplicate(c) }}>📋 Дублировать</button>
            <button onClick={() => { setMenuForId(null); onShare(c) }}>🔗 Поделиться…</button>
            <button
              className={styles.sidebarMenuDanger}
              onClick={() => { setMenuForId(null); onDelete(c) }}
            >
              🗑️ Удалить
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className={styles.sidebar} onClick={() => setMenuForId(null)}>
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarSectionTitle}>Предустановленные</div>
        {defaults.map(renderItem)}
      </div>

      {custom.length > 0 && (
        <div className={styles.sidebarSection}>
          <div className={styles.sidebarSectionTitle}>Мои подборки</div>
          {custom.map(renderItem)}
        </div>
      )}

      <button className={styles.sidebarCreate} onClick={onCreate}>
        + Создать подборку
      </button>
      <button className={styles.sidebarCreate} onClick={onImport}>
        ⤓ Импортировать по ссылке
      </button>
      <button className={styles.sidebarReset} onClick={onResetDefaults}>
        Сбросить дефолтные
      </button>
    </aside>
  )
}
