import { useEffect, useMemo, useState } from 'react'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import type { Collection, CollectionItem } from '@/shared/collections'
import { CollectionsSidebar } from './CollectionsSidebar'
import { CollectionEditorDialog } from './CollectionEditorDialog'
import { CollectionShareDialog } from './CollectionShareDialog'
import { CollectionImportDialog, type ImportResult } from './CollectionImportDialog'
import { CollectionsToolbar, type CollectionFilter, type CollectionPriceSide, type CollectionSortBy, type CollectionSortOrder, type CollectionViewMode } from './CollectionsToolbar'
import { CollectionItemCard } from './CollectionItemCard'
import { AddItemDialog } from './AddItemDialog'
import { ItemAlertDialog } from './ItemAlertDialog'
import { useCollections } from './hooks/useCollections'
import { useCollectionItems } from './hooks/useCollectionItems'
import { listAlerts, type AlertDTO } from '@/shared/api/pushAlerts'
import styles from './CollectionsPage.module.scss'

const VIEW_STORAGE_KEY = 'collections_viewMode'

interface UndoToast {
  message: string
  until: number
}

/** Страница «Подборки предметов» — Шаг 2: батч-загрузка, тулбар, карточки, добавление. */
export function CollectionsPage() {
  const [server, setServer] = usePShopServer()
  const {
    collections,
    activeCollection,
    setActiveCollection,
    createCollection,
    importCollection,
    updateCollection,
    duplicateCollection,
    deleteCollection,
    undoDelete,
    resetDefaults,
    addItem,
    removeItem,
    updateItem,
  } = useCollections()

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorTarget, setEditorTarget] = useState<Collection | null>(null)
  const [shareTarget, setShareTarget] = useState<Collection | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importInitialCode, setImportInitialCode] = useState<string | null>(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [alertTargetId, setAlertTargetId] = useState<number | null>(null)
  const [alerts, setAlerts] = useState<AlertDTO[]>([])

  const reloadAlerts = async () => {
    try {
      const { items } = await listAlerts()
      setAlerts(items)
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    void reloadAlerts()
  }, [])

  // Параметры тулбара
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<CollectionSortBy>('name')
  const [sortOrder, setSortOrder] = useState<CollectionSortOrder>('asc')
  const [priceSide, setPriceSide] = useState<CollectionPriceSide>('sell')
  const [filter, setFilter] = useState<CollectionFilter>('all')
  const [view, setView] = useState<CollectionViewMode>(() => {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'grid' || stored === 'list' || stored === 'compact' ? stored : 'grid'
  })
  const handleViewChange = (mode: CollectionViewMode) => {
    setView(mode)
    localStorage.setItem(VIEW_STORAGE_KEY, mode)
  }

  // Сброс поиска при смене подборки, чтобы не путать пользователя
  useEffect(() => {
    setSearch('')
  }, [activeCollection?.id])

  const ids = useMemo(
    () => activeCollection?.items.map((it) => it.itemId) ?? [],
    [activeCollection],
  )

  const { data, isLoading, isFetching, refetch } = useCollectionItems(ids, server)

  // Автообновление раз в 90с при видимой вкладке
  useEffect(() => {
    if (ids.length === 0) return
    const tick = () => {
      if (document.visibilityState === 'visible') void refetch()
    }
    const t = window.setInterval(tick, 90_000)
    return () => window.clearInterval(t)
  }, [ids.length, refetch])

  useEffect(() => {
    if (!undoToast) return
    const delay = Math.max(0, undoToast.until - Date.now())
    const t = window.setTimeout(() => setUndoToast(null), delay)
    return () => window.clearTimeout(t)
  }, [undoToast])

  const openCreate = () => { setEditorTarget(null); setEditorOpen(true) }
  const openEdit = (c: Collection) => { setEditorTarget(c); setEditorOpen(true) }

  // Автооткрытие импорта по ?share=<code> / ?c=<code>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('share') || params.get('c')
    if (code && /^[A-Za-z0-9]{4,16}$/.test(code)) {
      setImportInitialCode(code)
      setImportOpen(true)
      // убираем параметр из URL, чтобы не открывалось повторно
      params.delete('share')
      params.delete('c')
      const qs = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''))
    }
  }, [])

  const handleImport = (r: ImportResult) => {
    const created = importCollection({
      name: r.name,
      icon: r.icon,
      color: r.color,
      pinnedServer: r.pinnedServer,
      items: r.items,
    })
    setImportOpen(false)
    setImportInitialCode(null)
    setUndoToast({ message: `Подборка «${created.name}» импортирована`, until: Date.now() + 4000 })
  }

  const handleSubmit = (data: { name: string; icon?: string; color?: string }) => {
    if (editorTarget) updateCollection(editorTarget.id, data)
    else createCollection(data)
    setEditorOpen(false)
    setEditorTarget(null)
  }

  const handleDelete = (c: Collection) => {
    if (!window.confirm(`Удалить подборку «${c.name}»?`)) return
    deleteCollection(c.id)
    setUndoToast({ message: `Подборка «${c.name}» удалена`, until: Date.now() + 5000 })
  }

  const handleUndo = () => { undoDelete(); setUndoToast(null) }
  const handleReset = () => { resetDefaults(); setConfirmResetOpen(false) }

  // Отображаемые записи: фильтр по поиску/таргету + сортировка
  const visibleEntries = useMemo<CollectionItem[]>(() => {
    if (!activeCollection) return []
    const map = data?.items ?? {}
    const searchLc = search.trim().toLowerCase()

    let list = activeCollection.items.slice()

    if (searchLc) {
      list = list.filter((e) => {
        const name = map[e.itemId]?.info.name?.toLowerCase() ?? ''
        return name.includes(searchLc) || String(e.itemId).includes(searchLc)
      })
    }

    if (filter === 'withTarget') {
      list = list.filter((e) => e.targetPrice != null)
    } else if (filter === 'targetReached') {
      list = list.filter((e) => {
        if (e.targetPrice == null) return false
        const d = map[e.itemId]
        if (!d) return false
        const side = e.targetSide ?? 'sell'
        const p = side === 'sell' ? d.info.sell?.min : d.info.buy?.min
        if (p == null) return false
        return side === 'sell' ? p <= e.targetPrice : p >= e.targetPrice
      })
    }

    const dir = sortOrder === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortBy === 'name') {
        const na = map[a.itemId]?.info.name ?? String(a.itemId)
        const nb = map[b.itemId]?.info.name ?? String(b.itemId)
        return na.localeCompare(nb, 'ru') * dir
      }
      if (sortBy === 'addedAt') return (a.addedAt - b.addedAt) * dir
      const key = sortBy === 'sellMin' ? 'sell' : 'buy'
      const pa = map[a.itemId]?.info[key]?.min ?? Number.POSITIVE_INFINITY
      const pb = map[b.itemId]?.info[key]?.min ?? Number.POSITIVE_INFINITY
      return (pa - pb) * dir
    })

    return list
  }, [activeCollection, data, search, filter, sortBy, sortOrder])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Подборки предметов</h1>
      </div>

      <div className={styles.layout}>
        <CollectionsSidebar
          collections={collections}
          activeId={activeCollection?.id ?? null}
          onSelect={setActiveCollection}
          onCreate={openCreate}
          onEdit={openEdit}
          onDuplicate={(c) => duplicateCollection(c.id)}
          onDelete={handleDelete}
          onResetDefaults={() => setConfirmResetOpen(true)}
          onShare={(c) => setShareTarget(c)}
          onImport={() => { setImportInitialCode(null); setImportOpen(true) }}
        />

        <section className={styles.content}>
          <div className={styles.contentHeader}>
            <div className={styles.contentTitle}>
              <span className={styles.contentTitleIcon}>{activeCollection?.icon ?? '📦'}</span>
              <span>{activeCollection?.name ?? 'Нет активной подборки'}</span>
              {activeCollection && (
                <span className={styles.contentCount}>· {activeCollection.items.length} позиций</span>
              )}
            </div>
            <ServerSelector value={server} onChange={setServer} />
          </div>

          <CollectionsToolbar
            search={search}
            onSearch={setSearch}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={(by, ord) => { setSortBy(by); setSortOrder(ord) }}
            priceSide={priceSide}
            onPriceSideChange={setPriceSide}
            filter={filter}
            onFilterChange={setFilter}
            view={view}
            onViewChange={handleViewChange}
            updatedAt={data?.updatedAt ?? null}
            isFetching={isFetching}
            onRefresh={() => void refetch()}
            onAddItem={() => setAddOpen(true)}
            disabled={!activeCollection}
          />

          <div className={view === 'list' || view === 'compact' ? styles.gridList : styles.grid}>
            {!activeCollection ? (
              <div className={styles.empty}>Выберите подборку слева или создайте новую.</div>
            ) : activeCollection.items.length === 0 ? (
              <div className={styles.empty}>
                Подборка пуста. Нажмите «+ Добавить предмет», чтобы найти предметы на сервере «{server}».
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className={styles.empty}>Нет предметов под текущий фильтр/поиск.</div>
            ) : (
              visibleEntries.map((entry) => (
                <CollectionItemCard
                  key={entry.itemId}
                  entry={entry}
                  details={data?.items[entry.itemId]}
                  server={server}
                  view={view}
                  priceSide={priceSide}
                  isLoading={isLoading}
                  alerts={alerts.filter((a) => a.itemId === entry.itemId && a.server === server)}
                  onRemove={(id) => removeItem(activeCollection.id, id)}
                  onConfigureAlert={(id) => setAlertTargetId(id)}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <CollectionEditorDialog
        open={editorOpen}
        initial={editorTarget}
        onClose={() => { setEditorOpen(false); setEditorTarget(null) }}
        onSubmit={handleSubmit}
      />

      {shareTarget && (
        <CollectionShareDialog
          collection={shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}

      {importOpen && (
        <CollectionImportDialog
          initialCode={importInitialCode}
          onClose={() => { setImportOpen(false); setImportInitialCode(null) }}
          onImport={handleImport}
        />
      )}

      <AddItemDialog
        open={addOpen && !!activeCollection}
        server={server}
        excludeIds={ids}
        onClose={() => setAddOpen(false)}
        onAdd={(itemId) => {
          if (activeCollection) addItem(activeCollection.id, { itemId })
        }}
      />

      <ItemAlertDialog
        open={alertTargetId != null && !!activeCollection}
        server={server}
        entry={
          activeCollection?.items.find((it) => it.itemId === alertTargetId) ?? null
        }
        itemName={alertTargetId != null ? data?.items[alertTargetId]?.info.name : undefined}
        onClose={() => { setAlertTargetId(null); void reloadAlerts() }}
        onUpdateLocal={(patch) => {
          if (!activeCollection || alertTargetId == null) return
          updateItem(activeCollection.id, alertTargetId, patch)
        }}
      />

      {confirmResetOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmResetOpen(false) }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Сбросить предустановленные?</h3>
            </div>
            <div className={styles.modalBody}>
              Дефолтные подборки будут восстановлены к исходному виду. Ваши собственные подборки не будут затронуты.
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btn} onClick={() => setConfirmResetOpen(false)}>Отмена</button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleReset}>Сбросить</button>
            </div>
          </div>
        </div>
      )}

      {undoToast && (
        <div className={styles.toast} role="status">
          <span>{undoToast.message}</span>
          <button className={styles.toastUndo} onClick={handleUndo}>Отменить</button>
        </div>
      )}
    </div>
  )
}
