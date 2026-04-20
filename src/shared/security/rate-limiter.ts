/**
 * Клиентский rate limiter (скользящее окно + экспоненциальный backoff при 429).
 */

export interface RateLimiterConfig {
  maxRequests: number
  windowMs: number
  initialBackoffMs: number
  maxBackoffMs: number
  backoffMultiplier: number
}

export const DEFAULT_RATE_LIMITER_CONFIG: RateLimiterConfig = {
  maxRequests: 50,
  windowMs: 60_000,
  initialBackoffMs: 1_000,
  maxBackoffMs: 30_000,
  backoffMultiplier: 2,
}

interface BackoffState {
  currentDelayMs: number
  retryAfter: number
  consecutiveHits: number
}

export class ClientRateLimiter {
  private timestamps: number[] = []
  private backoff: BackoffState | null = null
  private readonly config: RateLimiterConfig

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITER_CONFIG, ...config }
  }

  canRequest(): boolean {
    const now = Date.now()
    if (this.backoff && now < this.backoff.retryAfter) return false
    this.cleanup(now)
    return this.timestamps.length < this.config.maxRequests
  }

  getWaitTime(): number {
    const now = Date.now()
    if (this.backoff && now < this.backoff.retryAfter) {
      return this.backoff.retryAfter - now
    }
    this.cleanup(now)
    if (this.timestamps.length < this.config.maxRequests) return 0
    const oldest = this.timestamps[0]
    return oldest + this.config.windowMs - now
  }

  recordRequest(): void {
    this.timestamps.push(Date.now())
  }

  handleTooManyRequests(retryAfterHeader?: string): void {
    const now = Date.now()
    let delayMs: number
    if (retryAfterHeader) {
      const seconds = parseInt(retryAfterHeader, 10)
      delayMs = isNaN(seconds) ? this.config.initialBackoffMs : seconds * 1000
    } else if (this.backoff) {
      delayMs = Math.min(
        this.backoff.currentDelayMs * this.config.backoffMultiplier,
        this.config.maxBackoffMs,
      )
    } else {
      delayMs = this.config.initialBackoffMs
    }
    this.backoff = {
      currentDelayMs: delayMs,
      retryAfter: now + delayMs,
      consecutiveHits: (this.backoff?.consecutiveHits ?? 0) + 1,
    }
  }

  handleSuccess(): void {
    this.backoff = null
  }

  reset(): void {
    this.timestamps = []
    this.backoff = null
  }

  private cleanup(now: number): void {
    const cutoff = now - this.config.windowMs
    while (this.timestamps.length > 0 && this.timestamps[0] <= cutoff) {
      this.timestamps.shift()
    }
  }
}

let globalLimiter: ClientRateLimiter | null = null

export function getRateLimiter(): ClientRateLimiter {
  if (!globalLimiter) globalLimiter = new ClientRateLimiter()
  return globalLimiter
}

export function resetRateLimiter(): void {
  globalLimiter?.reset()
  globalLimiter = null
}
