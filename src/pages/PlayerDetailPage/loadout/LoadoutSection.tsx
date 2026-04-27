import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getEquipmentSnapshot,
  getPlayerLoadoutHistory,
  getPlayerLoadoutLatest,
  getSkillRunesSnapshot,
  getSoulRelicsSnapshot,
} from '@/shared/api/loadout'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { formatDateTime } from '@/shared/utils/format'
import type { LoadoutTimelineEntry, PlayerLoadoutResponse } from '@/shared/types/loadout'
import { EquipmentTab } from './EquipmentTab'
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

  return (
    <div className={styles.section}>
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
          </div>
        )}
      </div>

      {loadoutQuery.isLoading && <div className={styles.center}><Spinner /></div>}
      {loadoutQuery.error && (
        <ErrorMessage message="Не удалось загрузить снаряжение" onRetry={() => loadoutQuery.refetch()} />
      )}
      {loadoutQuery.data && (
        <LoadoutContent data={loadoutQuery.data} tab={tab} onTabChange={setTab} />
      )}
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

function flagsLabel(entry: LoadoutTimelineEntry): string {
  const f: string[] = []
  if (entry.equipmentSnapshotId) f.push('🛡')
  if (entry.skillRunesSnapshotId) f.push('⚡')
  if (entry.soulRelicsSnapshotId) f.push('💎')
  return f.join('')
}
