import { notifyTextInput } from '@/shared/security/behavior-tracker'
import styles from './CollectionsPage.module.scss'

export type CollectionSortBy = 'name' | 'sellMin' | 'buyMin' | 'addedAt'
export type CollectionSortOrder = 'asc' | 'desc'
export type CollectionViewMode = 'grid' | 'list' | 'compact'
export type CollectionPriceSide = 'sell' | 'buy'
export type CollectionFilter = 'all' | 'withTarget' | 'targetReached'

export interface CollectionsToolbarProps {
  search: string
  onSearch: (v: string) => void
  sortBy: CollectionSortBy
  sortOrder: CollectionSortOrder
  onSortChange: (by: CollectionSortBy, order: CollectionSortOrder) => void
  priceSide: CollectionPriceSide
  onPriceSideChange: (side: CollectionPriceSide) => void
  filter: CollectionFilter
  onFilterChange: (f: CollectionFilter) => void
  view: CollectionViewMode
  onViewChange: (v: CollectionViewMode) => void
  updatedAt: number | null
  isFetching: boolean
  onRefresh: () => void
  onAddItem: () => void
  disabled?: boolean
}

/** Тулбар страницы подборок: поиск, сорт, фильтр, режимы, refresh, добавление. */
export function CollectionsToolbar(props: CollectionsToolbarProps) {
  const {
    search, onSearch,
    sortBy, sortOrder, onSortChange,
    priceSide, onPriceSideChange,
    filter, onFilterChange,
    view, onViewChange,
    updatedAt, isFetching, onRefresh,
    onAddItem, disabled,
  } = props

  return (
    <div className={styles.toolbar}>
      <input
        type="text"
        value={search}
        onChange={(e) => {
          notifyTextInput(search.length, e.target.value.length)
          onSearch(e.target.value)
        }}
        placeholder="Поиск по подборке..."
        className={styles.toolbarSearch}
        disabled={disabled}
      />

      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>Сорт:</span>
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as CollectionSortBy, sortOrder)}
          className={styles.toolbarSelect}
          disabled={disabled}
        >
          <option value="name">По названию</option>
          <option value="sellMin">По цене продажи</option>
          <option value="buyMin">По цене скупки</option>
          <option value="addedAt">По дате добавления</option>
        </select>
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => onSortChange(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')}
          title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
          disabled={disabled}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>Цена:</span>
        <div className={styles.toolbarToggle}>
          <button
            type="button"
            className={`${styles.toolbarToggleBtn} ${priceSide === 'sell' ? styles.toolbarToggleBtnActive : ''}`}
            onClick={() => onPriceSideChange('sell')}
            disabled={disabled}
          >
            Продажа
          </button>
          <button
            type="button"
            className={`${styles.toolbarToggleBtn} ${priceSide === 'buy' ? styles.toolbarToggleBtnActive : ''}`}
            onClick={() => onPriceSideChange('buy')}
            disabled={disabled}
          >
            Скупка
          </button>
        </div>
      </div>

      <div className={styles.toolbarGroup}>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as CollectionFilter)}
          className={styles.toolbarSelect}
          disabled={disabled}
        >
          <option value="all">Все</option>
          <option value="withTarget">С таргетом</option>
          <option value="targetReached">Таргет достигнут</option>
        </select>
      </div>

      <div className={styles.toolbarGroup}>
        <div className={styles.toolbarToggle}>
          <button
            type="button"
            className={`${styles.toolbarToggleBtn} ${view === 'grid' ? styles.toolbarToggleBtnActive : ''}`}
            onClick={() => onViewChange('grid')}
            title="Сетка"
          >
            ▦
          </button>
          <button
            type="button"
            className={`${styles.toolbarToggleBtn} ${view === 'list' ? styles.toolbarToggleBtnActive : ''}`}
            onClick={() => onViewChange('list')}
            title="Список"
          >
            ≡
          </button>
          <button
            type="button"
            className={`${styles.toolbarToggleBtn} ${view === 'compact' ? styles.toolbarToggleBtnActive : ''}`}
            onClick={() => onViewChange('compact')}
            title="Компакт"
          >
            ─
          </button>
        </div>
      </div>

      <div className={styles.toolbarSpacer} />

      <div className={styles.toolbarGroup}>
        {updatedAt && (
          <span className={styles.toolbarLabel}>
            обновлено <RelativeTime ts={updatedAt} />
          </span>
        )}
        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={onRefresh}
          disabled={disabled || isFetching}
          title="Обновить"
        >
          {isFetching ? '⟳' : '↻'}
        </button>
        <button
          type="button"
          className={`${styles.toolbarBtn} ${styles.toolbarBtnPrimary}`}
          onClick={onAddItem}
          disabled={disabled}
        >
          + Добавить предмет
        </button>
      </div>
    </div>
  )
}

function RelativeTime({ ts }: { ts: number }) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return <>{s} с назад</>
  const m = Math.floor(s / 60)
  if (m < 60) return <>{m} мин назад</>
  const h = Math.floor(m / 60)
  return <>{h} ч назад</>
}
