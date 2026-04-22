import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import {
  matchOgRoute,
  escapeHtmlAttr,
  absoluteUrl,
  buildMetaTags,
  injectMeta,
  createOgMiddleware,
  _clearOgCache,
} from '../og-cards.js'

describe('matchOgRoute', () => {
  it('распознаёт профиль игрока', () => {
    expect(matchOgRoute('/players/centaur/12345')).toEqual({
      type: 'player',
      server: 'centaur',
      playerId: 12345,
    })
  })

  it('распознаёт профиль команды', () => {
    expect(matchOgRoute('/teams/777')).toEqual({ type: 'team', teamId: 777 })
  })

  it('распознаёт профиль магазина', () => {
    expect(matchOgRoute('/shops/fenrir/42')).toEqual({
      type: 'shop',
      server: 'fenrir',
      playerId: 42,
    })
  })

  it('распознаёт профиль предмета', () => {
    expect(matchOgRoute('/items/9001')).toEqual({ type: 'item', itemId: 9001 })
  })

  it('допускает trailing slash', () => {
    expect(matchOgRoute('/items/1/')).toEqual({ type: 'item', itemId: 1 })
  })

  it('возвращает null для прочих путей', () => {
    expect(matchOgRoute('/')).toBeNull()
    expect(matchOgRoute('/players')).toBeNull()
    expect(matchOgRoute('/players/centaur')).toBeNull()
    expect(matchOgRoute('/players/centaur/abc')).toBeNull()
    expect(matchOgRoute('/items/abc')).toBeNull()
    expect(matchOgRoute('/collections')).toBeNull()
    expect(matchOgRoute('/players/centaur/1/extra')).toBeNull()
  })

  it('возвращает null для пустого ввода', () => {
    expect(matchOgRoute('')).toBeNull()
    expect(matchOgRoute(null)).toBeNull()
    expect(matchOgRoute(undefined)).toBeNull()
  })
})

describe('escapeHtmlAttr', () => {
  it('экранирует спецсимволы HTML', () => {
    expect(escapeHtmlAttr('<a href="x">&\'</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    )
  })

  it('обрабатывает null/undefined', () => {
    expect(escapeHtmlAttr(null)).toBe('')
    expect(escapeHtmlAttr(undefined)).toBe('')
  })

  it('приводит к строке', () => {
    expect(escapeHtmlAttr(42)).toBe('42')
  })
})

describe('absoluteUrl', () => {
  it('возвращает абсолютный URL как есть', () => {
    expect(absoluteUrl('https://site.ru', 'https://cdn.example.com/a.png'))
      .toBe('https://cdn.example.com/a.png')
  })

  it('склеивает относительный путь с базой', () => {
    expect(absoluteUrl('https://site.ru', '/assets/x.png'))
      .toBe('https://site.ru/assets/x.png')
  })

  it('убирает хвостовой слэш у базы и добавляет ведущий слэш', () => {
    expect(absoluteUrl('https://site.ru/', 'assets/x.png'))
      .toBe('https://site.ru/assets/x.png')
  })

  it('для пустого значения возвращает пустую строку', () => {
    expect(absoluteUrl('https://site.ru', '')).toBe('')
    expect(absoluteUrl('https://site.ru', null)).toBe('')
  })
})

describe('buildMetaTags', () => {
  it('содержит все ключевые OG- и Twitter-теги при наличии image', () => {
    const html = buildMetaTags({
      title: 'T',
      description: 'D',
      image: 'https://img/x.png',
      url: 'https://site/x',
      type: 'profile',
    })
    expect(html).toContain('<title>T</title>')
    expect(html).toContain('<meta name="description" content="D" />')
    expect(html).toContain('<meta property="og:title" content="T" />')
    expect(html).toContain('<meta property="og:type" content="profile" />')
    expect(html).toContain('<meta property="og:url" content="https://site/x" />')
    expect(html).toContain('<meta property="og:image" content="https://img/x.png" />')
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(html).toContain('<meta name="twitter:image" content="https://img/x.png" />')
  })

  it('без image использует summary и не добавляет image-тегов', () => {
    const html = buildMetaTags({
      title: 'T',
      description: 'D',
      image: '',
      url: 'https://site/x',
    })
    expect(html).toContain('<meta name="twitter:card" content="summary" />')
    expect(html).not.toContain('og:image')
    expect(html).not.toContain('twitter:image')
  })

  it('экранирует опасные символы во всех значениях', () => {
    const html = buildMetaTags({
      title: 'a"<b>',
      description: "x'y&z",
      image: 'https://i/" onload="x',
      url: 'https://u/?a=1&b=2',
    })
    // Сырых двойных кавычек внутри content="..." быть не должно — только &quot;
    expect(html).not.toMatch(/ onload="x"/)
    expect(html).not.toContain('<b>')
    expect(html).toContain('&quot;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&#39;')
    expect(html).toContain('&lt;b&gt;')
  })
})

describe('injectMeta', () => {
  const baseHtml =
    '<!doctype html><html><head>\n' +
    '    <meta charset="UTF-8" />\n' +
    '    <title>Old Title</title>\n' +
    '    <meta name="description" content="old" />\n' +
    '    <meta property="og:title" content="old" />\n' +
    '    <meta name="twitter:card" content="summary" />\n' +
    '  </head><body></body></html>'

  it('удаляет старый <title>, description, og:* и twitter:*', () => {
    const out = injectMeta(baseHtml, '<title>New</title>\n<meta property="og:title" content="New" />')
    expect(out).not.toContain('Old Title')
    expect(out).not.toMatch(/content="old"/)
    expect(out).toContain('<title>New</title>')
    expect(out).toContain('<meta property="og:title" content="New" />')
  })

  it('вставляет блок сразу после <head>', () => {
    const out = injectMeta(baseHtml, '<!--MARK-->')
    expect(out.indexOf('<!--MARK-->')).toBeGreaterThan(out.indexOf('<head>'))
    expect(out.indexOf('<!--MARK-->')).toBeLessThan(out.indexOf('<meta charset'))
  })

  it('добавляет в начало, если <head> отсутствует', () => {
    const out = injectMeta('<html><body>x</body></html>', '<title>T</title>')
    expect(out.startsWith('<title>T</title>')).toBe(true)
  })

  it('без ввода возвращает ввод', () => {
    expect(injectMeta('', 'X')).toBe('')
    expect(injectMeta(null, 'X')).toBe(null)
  })
})

describe('createOgMiddleware (integration, mocked fetch)', () => {
  const DIST_HTML =
    '<!doctype html><html><head><title>PW Hub Tracker</title></head><body><div id="root"></div></body></html>'

  let distPath

  beforeEach(() => {
    distPath = mkdtempSync(path.join(tmpdir(), 'og-test-'))
    writeFileSync(path.join(distPath, 'index.html'), DIST_HTML, 'utf-8')
    _clearOgCache()
  })

  afterEach(() => {
    try { rmSync(distPath, { recursive: true, force: true }) } catch { /* ignore */ }
    vi.restoreAllMocks()
  })

  function makeRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      set(k, v) {
        if (typeof k === 'object') Object.assign(this.headers, k)
        else this.headers[k] = v
        return this
      },
      status(code) {
        this.statusCode = code
        return this
      },
      send(body) {
        this.body = body
        return this
      },
    }
  }

  function makeReq(url, { method = 'GET', accept = 'text/html' } = {}) {
    const [pathname] = url.split('?')
    return {
      method,
      url,
      originalUrl: url,
      path: pathname,
      protocol: 'https',
      headers: { accept },
      get: (h) => (h.toLowerCase() === 'host' ? 'tracker.pw-hub.ru' : ''),
    }
  }

  it('пропускает не-профильные пути через next()', async () => {
    const mw = createOgMiddleware({
      distPath,
      apiTarget: 'https://api',
      apiKey: 'k',
      siteUrl: 'https://tracker.pw-hub.ru',
    })
    const req = makeReq('/collections')
    const res = makeRes()
    const next = vi.fn()
    await mw(req, res, next)
    expect(next).toHaveBeenCalledOnce()
    expect(res.body).toBeNull()
  })

  it('пропускает не-GET запросы', async () => {
    const mw = createOgMiddleware({
      distPath,
      apiTarget: 'https://api',
      apiKey: 'k',
      siteUrl: 'https://tracker.pw-hub.ru',
    })
    const req = makeReq('/players/centaur/1', { method: 'POST' })
    const res = makeRes()
    const next = vi.fn()
    await mw(req, res, next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('инжектит OG-теги для игрока (с fetch-моком)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        name: 'Hero',
        cls: 1, // Маг
        server: 'centaur',
        teamId: 0,
        rewardMoney: 0,
        weekResetTimestamp: 0,
        lastBattleTimestamp: 0,
        lastVisiteTimestamp: 0,
        updatedAt: '',
        battleStats: [{ matchPattern: 0, score: 1234, winCount: 0, battleCount: 0, weekBattleCount: 0, weekWinCount: 0, weekMaxScore: 0, rank: 0 }],
        team: { id: 5, name: 'Alpha', zoneId: 2 },
      }),
    })

    const mw = createOgMiddleware({
      distPath,
      apiTarget: 'https://api.example',
      apiKey: 'KEY',
      siteUrl: 'https://tracker.pw-hub.ru',
    })
    const req = makeReq('/players/centaur/1')
    const res = makeRes()
    const next = vi.fn()
    await mw(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(fetchSpy).toHaveBeenCalledOnce()
    const [calledUrl, opts] = fetchSpy.mock.calls[0]
    expect(calledUrl).toBe('https://api.example/api/arena/players/centaur/1')
    expect(opts.headers['X-Api-Key']).toBe('KEY')

    expect(res.headers['Content-Type']).toMatch(/text\/html/)
    expect(res.body).toContain('<meta property="og:title" content="Hero — Маг · PW Hub Tracker" />')
    expect(res.body).toContain('og:description')
    expect(res.body).toContain('Класс: Маг')
    expect(res.body).toContain('Команда: Alpha')
    expect(res.body).toContain('Рейтинг:')
    // og:image должен указывать на иконку класса
    expect(res.body).toContain('https://tracker.pw-hub.ru/assets/classes/mag.png')
    expect(res.body).toContain('twitter:card" content="summary_large_image"')
  })

  it('использует fallback-теги, если API недоступно', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, json: async () => ({}) })

    const mw = createOgMiddleware({
      distPath,
      apiTarget: 'https://api.example',
      apiKey: '',
      siteUrl: 'https://tracker.pw-hub.ru',
    })
    const req = makeReq('/teams/77')
    const res = makeRes()
    await mw(req, res, vi.fn())

    expect(res.body).toContain('<meta property="og:title"')
    // fallback-заголовок команды — "Команда #77"
    expect(res.body).toContain('Команда #77')
  })

  it('кэширует результат между запросами', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 42, name: 'Squad', zoneId: 3, members: [{}, {}, {}] }),
    })
    const mw = createOgMiddleware({
      distPath,
      apiTarget: 'https://api.example',
      apiKey: '',
      siteUrl: 'https://tracker.pw-hub.ru',
    })

    for (let i = 0; i < 3; i++) {
      const res = makeRes()
      await mw(makeReq('/teams/42'), res, vi.fn())
      expect(res.body).toContain('Squad')
    }
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
