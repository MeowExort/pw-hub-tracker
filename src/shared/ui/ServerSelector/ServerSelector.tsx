import { PSHOP_SERVERS, type PShopServer } from '@/shared/api/pshop'
import styles from './ServerSelector.module.scss'

const SERVER_LABELS: Record<PShopServer, string> = {
  capella: 'Capella',
  centaur: 'Centaur',
  alkor: 'Alkor',
  mizar: 'Mizar',
}

interface ServerSelectorProps {
  value: PShopServer
  onChange: (server: PShopServer) => void
}

/** Селектор сервера для PShop-страниц */
export function ServerSelector({ value, onChange }: ServerSelectorProps) {
  return (
    <div className={styles.selector}>
      {PSHOP_SERVERS.map((s) => (
        <button
          key={s}
          type="button"
          className={`${styles.btn} ${value === s ? styles.active : ''}`}
          onClick={() => onChange(s)}
        >
          {SERVER_LABELS[s]}
        </button>
      ))}
    </div>
  )
}
