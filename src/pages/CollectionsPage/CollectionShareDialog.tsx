import { useEffect, useState } from 'react'
import type { Collection } from '@/shared/collections'
import {
  createCollectionShare,
  type ShareCreateResponse,
} from '@/shared/collections'
import styles from './CollectionsPage.module.scss'

export interface CollectionShareDialogProps {
  collection: Collection
  onClose: () => void
}

/**
 * Диалог «Поделиться подборкой».
 * При открытии запрашивает у BFF короткую ссылку (`POST /api/share`)
 * и показывает её c кнопкой «Копировать».
 */
export function CollectionShareDialog({ collection, onClose }: CollectionShareDialogProps) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ok'; data: ShareCreateResponse }
    | { status: 'error'; message: string }
  >({ status: 'loading' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    createCollectionShare(collection)
      .then((data) => { if (!cancelled) setState({ status: 'ok', data }) })
      .catch((e) => {
        if (!cancelled) setState({ status: 'error', message: e?.message ?? 'Ошибка' })
      })
    return () => { cancelled = true }
  }, [collection])

  const handleCopy = async () => {
    if (state.status !== 'ok') return
    try {
      await navigator.clipboard.writeText(state.data.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard недоступен — пользователь выделит руками */
    }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3>Поделиться подборкой</h3>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Подборка</span>
            <div>
              {collection.icon ?? '📦'} {collection.name}
              {' · '}
              {collection.items.length} позиций
            </div>
          </div>

          {state.status === 'loading' && (
            <div className={styles.field}>Создаём короткую ссылку…</div>
          )}

          {state.status === 'error' && (
            <div className={`${styles.field} ${styles.alertError}`}>
              Не удалось создать ссылку: {state.message}
            </div>
          )}

          {state.status === 'ok' && (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Ссылка</span>
                <input
                  className={styles.input}
                  readOnly
                  value={state.data.url}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Код</span>
                <input
                  className={styles.input}
                  readOnly
                  value={state.data.code}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <div className={styles.toolbarHint}>
                Действует до {new Date(state.data.expiresAt).toLocaleString('ru-RU')}. Любой,
                у кого есть ссылка, сможет импортировать эту подборку к себе.
              </div>
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>Закрыть</button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleCopy}
            disabled={state.status !== 'ok'}
          >
            {copied ? '✓ Скопировано' : 'Копировать ссылку'}
          </button>
        </div>
      </div>
    </div>
  )
}
