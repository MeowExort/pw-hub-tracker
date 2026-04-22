import { useEffect, useState } from 'react'
import type { Collection } from '@/shared/collections'
import { ClearableInput } from '@/shared/ui/ClearableInput'
import styles from './CollectionsPage.module.scss'

const ICON_PRESETS = ['📦', '⚔️', '💍', '🧪', '🐉', '💎', '🎁', '🗡️', '🛡️', '🏹', '✨', '🌟', '🔥', '💰']
const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
]

export interface CollectionEditorDialogProps {
  open: boolean
  initial?: Collection | null
  onClose: () => void
  onSubmit: (data: { name: string; icon?: string; color?: string }) => void
}

/** Диалог создания/редактирования подборки (имя, эмодзи-иконка, акцентный цвет). */
export function CollectionEditorDialog({ open, initial, onClose, onSubmit }: CollectionEditorDialogProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState<string | undefined>(undefined)
  const [color, setColor] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setIcon(initial?.icon)
    setColor(initial?.color)
  }, [open, initial])

  if (!open) return null

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({ name: trimmed, icon, color })
  }

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3>{initial ? 'Редактирование подборки' : 'Новая подборка'}</h3>
          <button className={styles.iconBtn} onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Название</span>
            <ClearableInput
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onClear={() => setName('')}
              autoFocus
              maxLength={60}
              placeholder="Например: Крафт оружия"
            />
          </label>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Иконка</span>
            <div className={styles.pickerRow}>
              {ICON_PRESETS.map((i) => (
                <button
                  key={i}
                  type="button"
                  className={`${styles.pickerChip} ${icon === i ? styles.pickerChipActive : ''}`}
                  onClick={() => setIcon(i)}
                >
                  {i}
                </button>
              ))}
              <button
                type="button"
                className={`${styles.pickerChip} ${!icon ? styles.pickerChipActive : ''}`}
                onClick={() => setIcon(undefined)}
                title="Без иконки"
              >
                ∅
              </button>
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>Акцентный цвет</span>
            <div className={styles.pickerRow}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.colorChip} ${color === c ? styles.colorChipActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={c}
                />
              ))}
              <button
                type="button"
                className={`${styles.pickerChip} ${!color ? styles.pickerChipActive : ''}`}
                onClick={() => setColor(undefined)}
                title="Без цвета"
              >
                ∅
              </button>
            </div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btn} onClick={onClose}>Отмена</button>
          <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSubmit} disabled={!name.trim()}>
            {initial ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
