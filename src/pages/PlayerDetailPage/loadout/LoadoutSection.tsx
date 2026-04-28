import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  getEquipmentSnapshot,
  getPlayerLoadoutHistory,
  getPlayerLoadoutLatest,
  getSkillRunesSnapshot,
  getSoulRelicsSnapshot,
} from '@/shared/api/loadout'
import { formatDateTime } from '@/shared/utils/format'
import type { LoadoutTimelineEntry, PlayerLoadoutResponse } from '@/shared/types/loadout'
import { EquipmentTab } from './EquipmentTab'
import {
  MAIN_LAYOUT,
  POKER_SLOTS,
  STYLE_SLOTS,
  slotLabel,
} from './equipmentSlots'
import { SkillRunesTab } from './SkillRunesTab'
import { SoulRelicsTab } from './SoulRelicsTab'
import styles from './LoadoutSection.module.scss'

type TabKey = 'equipment' | 'runes' | 'relics'

interface Props {
  server: string
  playerId: number
}

export function LoadoutSection({ server, playerId }: Props) {
  const [tab, setTab] = useState<TabKey>('equipment')
  const [selectedTimeline, setSelectedTimeline] = useState<string>('latest')

  const historyQuery = useQuery({
    queryKey: ['loadout-history', server, playerId],
    queryFn: () => getPlayerLoadoutHistory(server, playerId, { limit: 50 }),
  })

  const selectedEntry: LoadoutTimelineEntry | undefined = useMemo(() => {
    if (selectedTimeline === 'latest') return undefined
    return historyQuery.data?.find((e) => e.recordedAt === selectedTimeline)
  }, [selectedTimeline, historyQuery.data])

  const loadoutQuery = useQuery<PlayerLoadoutResponse>({
    queryKey: ['loadout', server, playerId, selectedTimeline],
    queryFn: () => {
      if (!selectedEntry) {
        return getPlayerLoadoutLatest(server, playerId)
      }
      // Если в выбранном комплекте есть equipment-снапшот — anchor им,
      // иначе берём runes/relics. Это даёт детерминированный результат.
      if (selectedEntry.equipmentSnapshotId) {
        return getEquipmentSnapshot(server, playerId, selectedEntry.equipmentSnapshotId)
      }
      if (selectedEntry.skillRunesSnapshotId) {
        return getSkillRunesSnapshot(server, playerId, selectedEntry.skillRunesSnapshotId)
      }
      if (selectedEntry.soulRelicsSnapshotId) {
        return getSoulRelicsSnapshot(server, playerId, selectedEntry.soulRelicsSnapshotId)
      }
      return getPlayerLoadoutLatest(server, playerId)
    },
    // При смене слепка react-query генерирует новый queryKey → по умолчанию
    // data сбрасывается в undefined и контент вспыхивает спиннером. С
    // keepPreviousData предыдущий слепок остаётся на экране, пока новый
    // фетчится (`isFetching`-флаг). Высота не прыгает, табы не пропадают,
    // у дропдауна показываем маленький инлайн-спиннер как индикатор фонового
    // запроса.
    placeholderData: keepPreviousData,
  })

  // Если active tab не имеет данных — переключаемся на первый доступный.
  useEffect(() => {
    const data = loadoutQuery.data
    if (!data) return
    if (tab === 'equipment' && !data.equipment) {
      if (data.skillRunes) setTab('runes')
      else if (data.soulRelics) setTab('relics')
    }
  }, [loadoutQuery.data, tab])

  // Только initial-load (нет ни data, ни placeholderData). На последующих
  // переключениях слепка `loadoutQuery.data` остаётся прежним до прихода
  // нового — значит и UI стабилен.
  const isInitialLoad = loadoutQuery.isPending && !loadoutQuery.data
  // Идёт фоновое обновление (есть прежний результат, но фетчится свежий).
  const isRefetching = loadoutQuery.isFetching && !!loadoutQuery.data

  return (
    <div className={styles.section} aria-busy={loadoutQuery.isFetching || undefined}>
      <div className={styles.header}>
        <h2 className={styles.title}>🛡 Снаряжение</h2>
        {historyQuery.data && historyQuery.data.length > 0 && (
          <div className={styles.timeline}>
            <label htmlFor="loadout-timeline">Слепок:</label>
            <select
              id="loadout-timeline"
              className={styles.timelineSelect}
              value={selectedTimeline}
              onChange={(e) => setSelectedTimeline(e.target.value)}
            >
              <option value="latest">Последний</option>
              {historyQuery.data.map((entry) => (
                <option key={entry.recordedAt} value={entry.recordedAt}>
                  {formatDateTime(entry.recordedAt)}
                  {' '}{flagsLabel(entry)}
                </option>
              ))}
            </select>
            {isRefetching && <span className={styles.timelineLoading} aria-label="Загрузка..." />}
          </div>
        )}
      </div>

      {loadoutQuery.data ? (
        <LoadoutContent data={loadoutQuery.data} tab={tab} onTabChange={setTab} />
      ) : isInitialLoad || loadoutQuery.error ? (
        <div className={styles.skeletonContainer}>
          <div
            className={
              loadoutQuery.error
                ? styles.skeletonBlurred
                : styles.skeletonLoading
            }
          >
            <LoadoutSkeleton />
          </div>
          {loadoutQuery.error && (
            <div className={styles.skeletonOverlay}>
              <span className={styles.skeletonOverlayText}>Снаряжение не загружено</span>
              <button
                type="button"
                className={styles.skeletonOverlayRetry}
                onClick={() => loadoutQuery.refetch()}
              >
                Повторить
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

function LoadoutContent({
  data,
  tab,
  onTabChange,
}: {
  data: PlayerLoadoutResponse
  tab: TabKey
  onTabChange: (t: TabKey) => void
}) {
  const hasEquipment = !!data.equipment && data.equipment.items.length > 0
  const hasRunes = !!data.skillRunes && data.skillRunes.slots.length > 0
  const hasRelics = !!data.soulRelics && data.soulRelics.relics.length > 0

  if (!hasEquipment && !hasRunes && !hasRelics) {
    return <p className={styles.empty}>Нет данных о снаряжении игрока</p>
  }

  return (
    <>
      <div className={styles.tabs} role="tablist">
        <TabButton active={tab === 'equipment'} disabled={!hasEquipment} onClick={() => onTabChange('equipment')}>
          🛡 Экипировка{data.equipment ? ` (${data.equipment.items.length})` : ''}
        </TabButton>
        <TabButton active={tab === 'runes'} disabled={!hasRunes} onClick={() => onTabChange('runes')}>
          ⚡ Руны{data.skillRunes ? ` (${data.skillRunes.slots.length})` : ''}
        </TabButton>
        <TabButton active={tab === 'relics'} disabled={!hasRelics} onClick={() => onTabChange('relics')}>
          💎 Реликвии{data.soulRelics ? ` (${data.soulRelics.relics.length})` : ''}
        </TabButton>
      </div>

      {tab === 'equipment' && data.equipment && <EquipmentTab equipment={data.equipment} />}
      {tab === 'runes' && data.skillRunes && <SkillRunesTab runes={data.skillRunes} />}
      {tab === 'relics' && data.soulRelics && <SoulRelicsTab relics={data.soulRelics} />}
    </>
  )
}

function TabButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  const cls = [
    styles.tab,
    active ? styles.tabActive : '',
    disabled ? styles.tabDisabled : '',
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cls}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/**
 * Скелетон для самой первой загрузки (когда нет ни свежих данных,
 * ни placeholderData). Рисует «как-будто-табы» (3 disabled-кнопки) и
 * пустой doll-grid + пустые ряды «Карты генерала» / «Стиль» — с тем же
 * лэйаутом, что и реальный {@link EquipmentTab}, чтобы при появлении
 * данных высота секции не прыгала.
 */
function LoadoutSkeleton() {
  return (
    <>
      <div className={styles.tabs} role="tablist" aria-busy="true">
        <button type="button" className={`${styles.tab} ${styles.tabActive}`} disabled>
          🛡 Экипировка
        </button>
        <button type="button" className={styles.tab} disabled>
          ⚡ Руны
        </button>
        <button type="button" className={styles.tab} disabled>
          💎 Реликвии
        </button>
      </div>
      <div className={styles.equipmentLayout}>
        <div className={styles.dollGrid}>
          {MAIN_LAYOUT.map((s, i) => (
            <div
              key={i}
              className={`${styles.slotCell} ${s.index < 0 ? styles.slotReserved : styles.slotEmpty}`}
              style={{ gridRow: s.row, gridColumn: s.col }}
              aria-hidden="true"
            >
              {s.index >= 0 && (
                <span className={styles.slotEmptyLabel}>{slotLabel(s.index)}</span>
              )}
            </div>
          ))}
        </div>
        <div className={styles.dollSection}>
          <h3 className={styles.dollSectionTitle}>Карты генерала</h3>
          <div className={styles.specialRow}>
            {POKER_SLOTS.map((idx) => (
              <div
                key={idx}
                className={`${styles.slotCell} ${styles.slotEmpty}`}
                aria-hidden="true"
              >
                <span className={styles.slotEmptyLabel}>{slotLabel(idx)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.dollSection}>
          <h3 className={styles.dollSectionTitle}>Стиль</h3>
          <div className={styles.specialRow}>
            {STYLE_SLOTS.map((idx) => (
              <div
                key={idx}
                className={`${styles.slotCell} ${styles.slotEmpty}`}
                aria-hidden="true"
              >
                <span className={styles.slotEmptyLabel}>{slotLabel(idx)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function flagsLabel(entry: LoadoutTimelineEntry): string {
  const f: string[] = []
  if (entry.equipmentSnapshotId) f.push('🛡')
  if (entry.skillRunesSnapshotId) f.push('⚡')
  if (entry.soulRelicsSnapshotId) f.push('💎')
  return f.join('')
}
