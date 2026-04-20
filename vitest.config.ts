import { defineConfig } from 'vitest/config'
import path from 'path'
import { createHash } from 'crypto'

// Тестовые константы — имитируют то, что Vite подставляет при сборке.
const BUILD_SALT = 'test-salt'
const SIGNING_SECRET = 'test-signing-secret'
const TEST_ACTIONS: Array<[string, string, string, boolean]> = [
  ['GET', '/api/pshop/items', hash('getItems'), true],
  ['GET', '/api/pshop/items/:itemId/price-history', hash('getPriceHistory'), false],
  ['GET', '/api/arena/teams/search', hash('searchTeams'), true],
  ['POST', '/api/players/properties/by-ids', hash('getPlayerPropertiesByIds'), false],
]

function hash(name: string): string {
  return createHash('md5').update(`${name}:${BUILD_SALT}`).digest('base64url').slice(0, 8)
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __SIGNING_SECRET__: JSON.stringify(SIGNING_SECRET),
    __BUILD_SALT__: JSON.stringify(BUILD_SALT),
    __ACTION_MAP__: JSON.stringify(TEST_ACTIONS),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
