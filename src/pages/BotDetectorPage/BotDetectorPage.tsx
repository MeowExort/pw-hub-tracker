import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getBots, getBotScore } from '@/shared/api/pshop'
import { ServerSelector } from '@/shared/ui/ServerSelector'
import { usePShopServer } from '@/shared/hooks/usePShopServer'
import { Spinner } from '@/shared/ui/Spinner'
import { ErrorMessage } from '@/shared/ui/ErrorMessage'
import { formatNumber, formatDate, formatSeconds } from '@/shared/utils/pshop'
import styles from '@/shared/styles/pshop.module.scss'

/** Страница «Детектор ботов» */
export function BotDetectorPage() {
  const [server, setServer] = usePShopServer()
  const [days, setDays] = useState(7)
  const [minEvents, setMinEvents] = useState(10)
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null)

  const bots = useQuery({
    queryKey: ['bots', server, days, minEvents],
    queryFn: () => getBots(server, { days, minEvents }),
  })

  const botScore = useQuery({
    queryKey: ['bot-score', server, selectedPlayerId, days],
    queryFn: () => getBotScore(selectedPlayerId!, server, { days }),
    enabled: !!selectedPlayerId,
  })

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Детектор ботов</h1>
        <ServerSelector value={server} onChange={(s) => { setServer(s); setSelectedPlayerId(null) }} />
      </div>

      <div className={styles.filters}>
        <label>
          Период (дней): <input
            type="number"
            className={styles.filterInput}
            value={days}
            min={1}
            max={90}
            onChange={(e) => setDays(Number(e.target.value) || 7)}
          />
        </label>
        <label>
          Мин. событий: <input
            type="number"
            className={styles.filterInput}
            value={minEvents}
            min={1}
            onChange={(e) => setMinEvents(Number(e.target.value) || 10)}
          />
        </label>
      </div>

      {bots.isLoading && <Spinner />}
      {bots.error && <ErrorMessage message={(bots.error as Error).message} />}

      {selectedPlayerId && (
        <div className={styles.detailPanel}>
          <button className={styles.detailClose} onClick={() => setSelectedPlayerId(null)}>✕</button>
          <h3>
            Бот-детекция — игрок #{selectedPlayerId}
            {' '}
            <Link to={`/shops/${server}/${selectedPlayerId}`} style={{ fontSize: 'var(--font-size-sm)' }}>
              → Магазин
            </Link>
          </h3>

          {botScore.isLoading && <Spinner />}
          {botScore.error && <ErrorMessage message={(botScore.error as Error).message} />}

          {botScore.data && (
            <>
              <div className={styles.cards}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Всего событий</div>
                  <div className={styles.cardValue}>{botScore.data.totalEvents}</div>
                </div>
                {botScore.data.events.length > 0 && (
                  <div className={styles.card}>
                    <div className={styles.cardLabel}>Средняя реакция</div>
                    <div className={styles.cardValue}>
                      {formatSeconds(
                        botScore.data.events.reduce((s, e) => s + e.reactionSeconds, 0) / botScore.data.events.length
                      )}
                    </div>
                  </div>
                )}
              </div>

              {botScore.data.events.length > 0 && (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Предмет</th>
                      <th>Тип</th>
                      <th>Старая цена</th>
                      <th>Новая цена</th>
                      <th>Цена конкурента</th>
                      <th>Реакция</th>
                      <th>Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botScore.data.events.map((e, i) => (
                      <tr key={i}>
                        <td>{e.itemId}</td>
                        <td className={e.isSell ? styles.sell : styles.buy}>
                          {e.isSell ? 'Продажа' : 'Скупка'}
                        </td>
                        <td>{formatNumber(e.oldPrice)}</td>
                        <td>{formatNumber(e.newPrice)}</td>
                        <td>{formatNumber(e.competitorPrice)}</td>
                        <td>{formatSeconds(e.reactionSeconds)}</td>
                        <td>{formatDate(e.detectedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {bots.data && bots.data.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID игрока</th>
              <th>Событий</th>
              <th>Уникальных предметов</th>
              <th>Средняя реакция</th>
              <th>Последнее обнаружение</th>
              <th>Магазин</th>
            </tr>
          </thead>
          <tbody>
            {bots.data.map((bot) => (
              <tr
                key={bot.playerId}
                className={styles.clickableRow}
                onClick={() => setSelectedPlayerId(bot.playerId)}
              >
                <td>{bot.playerId}</td>
                <td>{bot.botEvents}</td>
                <td>{bot.uniqueItems}</td>
                <td>{formatSeconds(bot.avgReactionSeconds)}</td>
                <td>{formatDate(bot.lastDetectedAt)}</td>
                <td>
                  <Link
                    to={`/shops/${server}/${bot.playerId}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: 'var(--primary)' }}
                  >
                    Открыть
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {bots.data && bots.data.length === 0 && (
        <div className={styles.emptyState}>Нет подозрительных игроков за выбранный период</div>
      )}
    </div>
  )
}
