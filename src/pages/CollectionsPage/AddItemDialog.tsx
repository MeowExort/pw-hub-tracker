import { useState, useEffect } from 'react'
import { useDebouncedValue } from '../../shared/hooks/useDebouncedValue'
import { useQuery } from '@tanstack/react-query'
import { getItems, type PShopServer } from '@/shared/api/pshop'
import { notifyTextInput } from '@/shared/security/behavior-tracker'
import { formatNumber } from '@/shared/utils/pshop'
import styles from './CollectionsPage.module.scss'

export interface AddItemDialogProps {
  open: boolean
  server: PShopServer
  excludeIds: readonly number[]
  onClose: () => void
  onAdd: (itemId: number) => void
}

const PAGE_SIZE = 15

/** Диалог поиска и добавления предметов в активную подборку. */
export function AddItemDialog({ open, server, excludeIds, onClose, onAdd }: AddItemDialogProps) {
  const [search, setSearch] = useState('')
  const deferred = useDebouncedValue(search.trim())
  const excludeSet = new Set(excludeIds)

  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  const { data, isLoading, error } = useQuery({
    queryKey: ['collections-add-search', server, deferred],
    enabled: open && deferred.length > 0,
    staleTime: 30_000,
    queryFn: () =>
      getItems({
        server,
        search: deferred,
        page: 1,
        pageSize: PAGE_SIZE,
        sortBy: 'name',
        sortOrder: 'asc',
        isSell: true,
      }),
  })

  if (!open) return null

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles.modalWide}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Добавить предмет</h3>
        </div>
        <div className={styles.modalBody}>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              notifyTextInput(search.length, e.target.value.length)
              setSearch(e.target.value)
            }}
            placeholder="Начните вводить название..."
            className={styles.modalInput}
            autoFocus
          />

          <div className={styles.addList}>
            {deferred.length === 0 && (
              <div className={styles.addHint}>Введите название для поиска по серверу «{server}».</div>
            )}
            {deferred.length > 0 && isLoading && (
              <div className={styles.addHint}>Загрузка...</div>
            )}
            {error && <div className={styles.addHint}>Ошибка: {(error as Error).message}</div>}
            {data && data.items.length === 0 && (
              <div className={styles.addHint}>Ничего не найдено.</div>
            )}
            {data?.items.map((it) => {
              const already = excludeSet.has(it.id)
              return (
                <div key={it.id} className={styles.addRow}>
                  {it.icon && <img src={it.icon} alt="" className={styles.addIcon} />}
                  <div className={styles.addInfo}>
                    <div className={styles.addName}>{it.name}</div>
                    <div className={styles.addPrices}>
                      Продажа: {it.sell?.min != null ? formatNumber(it.sell.min) : '—'}
                      {' · '}
                      Скупка: {it.buy?.min != null ? formatNumber(it.buy.min) : '—'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.btn} ${already ? '' : styles.btnPrimary}`}
                    disabled={already}
                    onClick={() => onAdd(it.id)}
                  >
                    {already ? 'Уже в подборке' : 'Добавить'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}
