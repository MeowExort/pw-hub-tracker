import { useState, useCallback } from 'react'
import type { PShopServer } from '@/shared/api/pshop'

const STORAGE_KEY = 'pshop-selected-server'
const DEFAULT_SERVER: PShopServer = 'capella'

export function usePShopServer() {
  const [server, setServerInternal] = useState<PShopServer>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved as PShopServer
    return DEFAULT_SERVER
  })

  const setServer = useCallback((newServer: PShopServer) => {
    setServerInternal(newServer)
    localStorage.setItem(STORAGE_KEY, newServer)
  }, [])

  return [server, setServer] as const
}
