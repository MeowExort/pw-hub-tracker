import styles from './ToggleSwitch.module.scss'

interface ToggleSwitchProps {
  checked: boolean
  onChange: () => void
}

export function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <label className={styles.checkbox} onClick={(e) => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className={styles.box} />
    </label>
  )
}
