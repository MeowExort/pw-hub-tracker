/**
 * ASN / datacenter-IP lookup (задача 4 ТЗ).
 *
 * Источники данных (в порядке приоритета):
 *   1) Локальная БД MaxMind GeoLite2-ASN (`server/data/GeoLite2-ASN.mmdb`) —
 *      подключается через `mmdb-lib`, если модуль и файл присутствуют.
 *      В противном случае используется fallback.
 *   2) Fallback-список публичных CIDR-диапазонов известных датацентров
 *      (AWS / GCP / Azure / Hetzner / DigitalOcean / OVH / Linode).
 *
 * Оффлайн-режим (нет БД и не совпал ни один CIDR) не ломает сервер —
 * возвращается `{ asn: null, org: null, isDatacenter: false, source: 'none' }`.
 *
 * Список CIDR — намеренно небольшой «репрезентативный» seed: для
 * production-использования ожидается полноценная MaxMind-база (обновляется
 * через `scripts/update-asn.js` или ручной download).
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Fallback-список CIDR датацентров. Формат: [cidr, org].
 * Покрытие заведомо неполное; достаточно для задетекчивания большинства
 * «тупых» парсеров на бесплатных VPS.
 */
const DATACENTER_CIDRS = [
  // AWS (часть us-east-1 / eu-central-1 / eu-west-1)
  ['3.0.0.0/9', 'AWS'],
  ['13.32.0.0/15', 'AWS'],
  ['18.130.0.0/16', 'AWS'],
  ['18.184.0.0/15', 'AWS'],
  ['18.196.0.0/15', 'AWS'],
  ['18.208.0.0/13', 'AWS'],
  ['34.192.0.0/10', 'AWS'],
  ['35.160.0.0/13', 'AWS'],
  ['52.0.0.0/11', 'AWS'],
  ['54.64.0.0/11', 'AWS'],
  // GCP
  ['34.64.0.0/10', 'GCP'],
  ['35.184.0.0/13', 'GCP'],
  ['35.192.0.0/14', 'GCP'],
  ['35.224.0.0/12', 'GCP'],
  ['104.196.0.0/14', 'GCP'],
  // Azure
  ['13.64.0.0/11', 'Azure'],
  ['20.0.0.0/11', 'Azure'],
  ['40.64.0.0/10', 'Azure'],
  ['52.224.0.0/11', 'Azure'],
  ['104.40.0.0/13', 'Azure'],
  // Hetzner
  ['5.9.0.0/16', 'Hetzner'],
  ['78.46.0.0/15', 'Hetzner'],
  ['88.198.0.0/16', 'Hetzner'],
  ['116.202.0.0/15', 'Hetzner'],
  ['135.181.0.0/16', 'Hetzner'],
  ['138.201.0.0/16', 'Hetzner'],
  ['159.69.0.0/16', 'Hetzner'],
  ['168.119.0.0/16', 'Hetzner'],
  ['176.9.0.0/16', 'Hetzner'],
  ['188.40.0.0/16', 'Hetzner'],
  // DigitalOcean
  ['104.131.0.0/16', 'DigitalOcean'],
  ['104.236.0.0/16', 'DigitalOcean'],
  ['134.122.0.0/16', 'DigitalOcean'],
  ['138.68.0.0/16', 'DigitalOcean'],
  ['139.59.0.0/16', 'DigitalOcean'],
  ['143.198.0.0/16', 'DigitalOcean'],
  ['146.190.0.0/16', 'DigitalOcean'],
  ['157.230.0.0/16', 'DigitalOcean'],
  ['159.65.0.0/16', 'DigitalOcean'],
  ['159.89.0.0/16', 'DigitalOcean'],
  ['164.90.0.0/16', 'DigitalOcean'],
  ['167.99.0.0/16', 'DigitalOcean'],
  ['174.138.0.0/17', 'DigitalOcean'],
  ['178.62.0.0/16', 'DigitalOcean'],
  ['188.166.0.0/16', 'DigitalOcean'],
  // OVH
  ['51.38.0.0/16', 'OVH'],
  ['51.68.0.0/16', 'OVH'],
  ['51.75.0.0/16', 'OVH'],
  ['51.83.0.0/16', 'OVH'],
  ['51.89.0.0/16', 'OVH'],
  ['51.91.0.0/16', 'OVH'],
  ['51.158.0.0/15', 'OVH'],
  ['54.36.0.0/14', 'OVH'],
  ['91.121.0.0/16', 'OVH'],
  ['92.222.0.0/16', 'OVH'],
  ['94.23.0.0/16', 'OVH'],
  ['137.74.0.0/16', 'OVH'],
  ['142.44.0.0/16', 'OVH'],
  ['144.217.0.0/16', 'OVH'],
  ['147.135.0.0/16', 'OVH'],
  ['149.202.0.0/16', 'OVH'],
  ['151.80.0.0/16', 'OVH'],
  ['167.114.0.0/16', 'OVH'],
  ['178.32.0.0/15', 'OVH'],
  ['188.165.0.0/16', 'OVH'],
  // Linode / Akamai
  ['45.33.0.0/16', 'Linode'],
  ['45.56.0.0/16', 'Linode'],
  ['45.79.0.0/16', 'Linode'],
  ['50.116.0.0/16', 'Linode'],
  ['66.175.208.0/20', 'Linode'],
  ['96.126.96.0/19', 'Linode'],
  ['139.162.0.0/16', 'Linode'],
  ['172.104.0.0/15', 'Linode'],
  ['173.255.192.0/18', 'Linode'],
  ['192.46.208.0/20', 'Linode'],
  ['192.81.128.0/18', 'Linode'],
  ['198.58.96.0/19', 'Linode'],
  // Vultr / Choopa
  ['45.32.0.0/16', 'Vultr'],
  ['45.63.0.0/16', 'Vultr'],
  ['45.76.0.0/16', 'Vultr'],
  ['45.77.0.0/16', 'Vultr'],
  ['108.61.0.0/16', 'Vultr'],
  ['149.28.0.0/16', 'Vultr'],
  ['155.138.128.0/17', 'Vultr'],
  ['207.148.0.0/16', 'Vultr'],
]

/** Преобразовать IPv4 в uint32. Возвращает null для невалидных. */
function ipv4ToInt(ip) {
  if (typeof ip !== 'string') return null
  // Убрать возможный префикс "::ffff:" (IPv4-mapped IPv6).
  const clean = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean)
  if (!m) return null
  const a = +m[1], b = +m[2], c = +m[3], d = +m[4]
  if (a > 255 || b > 255 || c > 255 || d > 255) return null
  // Использовать беззнаковое через >>> 0.
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}

/** Парсинг "a.b.c.d/N" → { base: uint32, mask: uint32 } | null */
function parseCidr(cidr) {
  const slash = cidr.indexOf('/')
  if (slash === -1) return null
  const ip = cidr.slice(0, slash)
  const bits = parseInt(cidr.slice(slash + 1), 10)
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return null
  const base = ipv4ToInt(ip)
  if (base === null) return null
  const mask = bits === 0 ? 0 : ((0xffffffff << (32 - bits)) >>> 0)
  return { base: (base & mask) >>> 0, mask }
}

// Pre-parse all CIDRs once.
const PARSED_CIDRS = DATACENTER_CIDRS.map(([c, org]) => ({ cidr: parseCidr(c), org })).filter(
  (x) => x.cidr !== null,
)

/** LRU-кэш на 10k записей. */
const LRU_CAP = 10_000
const lru = new Map()
function lruGet(key) {
  if (!lru.has(key)) return undefined
  const v = lru.get(key)
  lru.delete(key)
  lru.set(key, v)
  return v
}
function lruSet(key, value) {
  if (lru.has(key)) lru.delete(key)
  lru.set(key, value)
  if (lru.size > LRU_CAP) {
    // удалить самый старый
    const firstKey = lru.keys().next().value
    lru.delete(firstKey)
  }
}

// --- MaxMind (опционально) ---

let mmdbReader = null
let mmdbTried = false

async function tryLoadMmdb() {
  if (mmdbTried) return mmdbReader
  mmdbTried = true
  try {
    const dbPath = process.env.ASN_MMDB_PATH || path.resolve(__dirname, 'data', 'GeoLite2-ASN.mmdb')
    if (!existsSync(dbPath)) return null
    // Динамический импорт через переменную, чтобы vite/vitest не пытались
    // статически разрешить модуль при сборке/прогоне (БД опциональна).
    const mmdbModuleName = 'mmdb-lib'
    const mmdb = await import(/* @vite-ignore */ mmdbModuleName).catch(() => null)
    if (!mmdb) return null
    const buffer = readFileSync(dbPath)
    const Reader = mmdb.Reader || mmdb.default?.Reader
    if (!Reader) return null
    mmdbReader = new Reader(buffer)
    return mmdbReader
  } catch {
    return null
  }
}
// Запустим попытку загрузки, но не ждём результата.
tryLoadMmdb().catch(() => {})

/** Список известных "датацентровых" ASN (когда MaxMind доступен). */
const DATACENTER_ASNS_DEFAULT = new Set([
  16509, 14618, // AWS
  15169, // Google
  8075, // Microsoft/Azure
  24940, // Hetzner
  14061, 394362, // DigitalOcean
  16276, // OVH
  63949, 20940, // Linode / Akamai
  20473, // Choopa / Vultr
  16265, // LeaseWeb
])

function loadExtraDatacenterAsns() {
  const raw = process.env.DATACENTER_ASNS
  if (!raw) return DATACENTER_ASNS_DEFAULT
  const extra = raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
  return new Set([...DATACENTER_ASNS_DEFAULT, ...extra])
}
const DATACENTER_ASNS = loadExtraDatacenterAsns()

/**
 * Вернуть информацию об ASN IP. Не бросает исключений.
 *
 * @param {string} ip — IPv4 (или "::ffff:IPv4"), IPv6 не поддерживается fallback-ом.
 * @returns {{ asn: number|null, org: string|null, isDatacenter: boolean, source: 'mmdb'|'cidr'|'none' }}
 */
export function lookupAsn(ip) {
  if (!ip || typeof ip !== 'string') {
    return { asn: null, org: null, isDatacenter: false, source: 'none' }
  }
  const cached = lruGet(ip)
  if (cached !== undefined) return cached

  // 1) MaxMind.
  if (mmdbReader) {
    try {
      const rec = mmdbReader.get(ip)
      if (rec && (rec.autonomous_system_number || rec.autonomous_system_organization)) {
        const asn = rec.autonomous_system_number ?? null
        const org = rec.autonomous_system_organization ?? null
        const isDatacenter = typeof asn === 'number' && DATACENTER_ASNS.has(asn)
        const out = { asn, org, isDatacenter, source: 'mmdb' }
        lruSet(ip, out)
        return out
      }
    } catch {
      // игнорируем и идём в fallback
    }
  }

  // 2) Fallback CIDR.
  const asInt = ipv4ToInt(ip)
  if (asInt === null) {
    const out = { asn: null, org: null, isDatacenter: false, source: 'none' }
    lruSet(ip, out)
    return out
  }
  for (const { cidr, org } of PARSED_CIDRS) {
    if (((asInt & cidr.mask) >>> 0) === cidr.base) {
      const out = { asn: null, org, isDatacenter: true, source: 'cidr' }
      lruSet(ip, out)
      return out
    }
  }

  const out = { asn: null, org: null, isDatacenter: false, source: 'none' }
  lruSet(ip, out)
  return out
}

/** Для тестов. */
export const __internals = {
  ipv4ToInt,
  parseCidr,
  DATACENTER_CIDRS,
  lru,
  clearLru: () => lru.clear(),
}
