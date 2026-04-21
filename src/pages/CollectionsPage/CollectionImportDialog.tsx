import { useEffect, useState } from 'react'
import {
  extractShareCode,
  readCollectionShare,
  sharePayloadToItems,
  type CollectionShareV1,
} from '@/shared/collections'
import styles from './CollectionsPage.module.scss'

export interface ImportResult {
  name: string
  icon?: string
  color?: string
  pinnedServer?: CollectionShareV1['pinnedServer']
  items: ReturnType<typeof sharePayloadToItems>
}

export interface CollectionImportDialogProps {
  /** Если задан — автозагрузка указанного кода при открытии. */
  initialCode?: string | null
  onClose: () => void
  onImport: (result: ImportResult) => void
}

/**
 * Диалог импорта подборки по короткой ссылке / коду.
 * Пользователь вставляет URL или код, мы запрашиваем `/api/share/:code`,
 * показываем превью (название + количество позиций) и создаём новую подборку.
 */
export function CollectionImportDialog({ initialCode, onClose, onImport }: CollectionImportDialogProps) {
  const [input, setInput] = useState(initialCode ?? '')
  const [preview, setPreview] = useState<CollectionShareV1 | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadByCodeOrUrl = async (raw: string) => {
    const code = extractShareCode(raw)
    if (!code) {
      setError('Укажите корректную ссылку или код')
      setPreview(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await readCollectionShare(code)
      setPreview(res.payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (initialCode) {
      void loadByCodeOrUrl(initialCode)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode])

  const handleImport = () => {
    if (!preview) return
    onImport({
      name: preview.name,
      icon: preview.icon,
      color: preview.color,
      pinnedServer: preview.pinnedServer,
      items: sharePayloadToItems(preview),
    })
  }

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>Импорт подборки</h3>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ссылка или код</span>
            <input
              type="text"
              className={styles.input}
              value={input}
              onChange={(e) => { setInput(e.target.value); setPreview(null); setError(null) }}
              placeholder="https://…/c/XXXXXXXX или XXXXXXXX"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && input.trim()) void loadByCodeOrUrl(input)
              }}
            />
          </label>

          {error && <div className={`${styles.field} ${styles.alertError}`}>{error}</div>}

          {preview && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Что будет импортировано</span>
              <div>
                {preview.icon ?? '📦'} <strong>{preview.name}</strong>
                {' · '}
                {preview.items.length} позиций
              </div>
              <div className={styles.toolbarHint}>
                Будет создана новая подборка в разделе «Мои подборки». Оригинал не изменится.
              </div>
            </div>
          )}
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>Отмена</button>
          {preview ? (
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleImport}>
              Импортировать
            </button>
          ) : (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => void loadByCodeOrUrl(input)}
              disabled={loading || !input.trim()}
            >
              {loading ? 'Загрузка…' : 'Загрузить'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
