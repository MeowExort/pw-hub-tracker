/**
 * Модальное окно hCaptcha.
 * Показывается, когда BFF вернул `{ captchaRequired: true }` — пользователь
 * решает CAPTCHA, токен возвращается в `requestCaptcha()` для повтора запроса.
 */

import { useEffect, useRef, useState } from 'react'
import {
  onCaptchaRequired,
  solveCaptcha,
  cancelCaptcha,
  getHcaptchaSiteKey,
} from '@/shared/security/captcha'

declare global {
  interface Window {
    hcaptcha?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark'
        },
      ) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
  }
}

const HCAPTCHA_SCRIPT_SRC = 'https://js.hcaptcha.com/1/api.js?render=explicit'

/** Однократная загрузка hCaptcha-скрипта. */
function loadHcaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.hcaptcha) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src^="${HCAPTCHA_SCRIPT_SRC}"]`)
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('hCaptcha load failed')))
    })
  }
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = HCAPTCHA_SCRIPT_SRC
    s.async = true
    s.defer = true
    s.addEventListener('load', () => resolve())
    s.addEventListener('error', () => reject(new Error('hCaptcha load failed')))
    document.head.appendChild(s)
  })
}

/** Модалка с виджетом hCaptcha. Монтируется один раз в корне приложения. */
export function CaptchaModal() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    return onCaptchaRequired((required) => setOpen(required))
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    loadHcaptchaScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.hcaptcha) return
        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: getHcaptchaSiteKey(),
          theme: 'dark',
          callback: (token: string) => {
            solveCaptcha(token)
            setOpen(false)
          },
          'error-callback': () => {
            // оставим модалку открытой, пусть попробует ещё раз
          },
          'expired-callback': () => {
            if (widgetIdRef.current && window.hcaptcha) {
              window.hcaptcha.reset(widgetIdRef.current)
            }
          },
        })
      })
      .catch((err) => {
        console.error('[CaptchaModal] Не удалось загрузить hCaptcha:', err)
      })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.hcaptcha) {
        try {
          window.hcaptcha.remove(widgetIdRef.current)
        } catch {
          // ignore
        }
        widgetIdRef.current = null
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#1b1d22',
          color: '#fff',
          padding: 24,
          borderRadius: 12,
          minWidth: 340,
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Подтвердите, что вы не робот</h3>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Обнаружена подозрительная активность. Пройдите CAPTCHA, чтобы продолжить.
        </p>
        <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 78 }} />
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <button
            type="button"
            onClick={() => {
              cancelCaptcha()
              setOpen(false)
            }}
            style={{
              background: 'transparent',
              color: '#aaa',
              border: '1px solid #444',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
