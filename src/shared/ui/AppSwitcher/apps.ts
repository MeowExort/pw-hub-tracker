export interface PwHubApp {
  id: 'tracker' | 'relics' | 'claner'
  title: string
  description: string
  url: string
  icon: string
  /** Путь к изображению иконки. Если задан — используется вместо эмодзи. */
  iconSrc?: string
  /** Фоновый цвет иконки */
  color: string
}

export const APPS: PwHubApp[] = [
  {
    id: 'tracker',
    title: 'Трекер',
    description: 'Арена, комка, игроки',
    url: 'https://tracker.pw-hub.ru',
    icon: '⚔️',
    iconSrc: '/icon.svg',
    color: 'linear-gradient(135deg, #5b7ff5 0%, #3f5fd0 100%)',
  },
  {
    id: 'relics',
    title: 'Реликвии',
    description: 'База реликвий',
    url: 'https://relics.pw-hub.ru',
    icon: '🏺',
    iconSrc: '/icon-relics.png',
    color: 'linear-gradient(135deg, #a06bf0 0%, #7a3fd0 100%)',
  },
  {
    id: 'claner',
    title: 'Кланер',
    description: 'Инструменты для кланов',
    url: 'https://claner.pw-hub.ru',
    icon: '🛡️',
    iconSrc: '/icon-claner.svg',
    color: 'linear-gradient(135deg, #4fb97a 0%, #2f8f56 100%)',
  },
]

export const CURRENT_APP_ID: PwHubApp['id'] = 'tracker'
