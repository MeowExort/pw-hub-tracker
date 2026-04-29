import type { SkillRuneSlot, SkillRunesSnapshot } from '@/shared/types/loadout'
import { ItemDescription } from '@/shared/ui/ItemDescription'
import { decodeUnicodeEscapes, itemIconUrl } from './equipmentSlots'
import { HoverTooltip } from './HoverTooltip'
import styles from './LoadoutSection.module.scss'

interface Props {
  runes: SkillRunesSnapshot
}

/**
 * Подсказки для рассуждения над раскладкой:
 *   - В игре 12 рунных слотов = 2 «круга» (страницы) по 6.
 *   - Внутри каждого круга номера 1..6 расставлены по гексу:
 *     1 сверху, 4-5 в верхних углах, 2-3 в нижних, 6 снизу.
 *   - В DTO `slot` 0-индексный, монотонный 0..11 → page 1 = [0..5],
 *     page 2 = [6..11], позиция в круге = slot % 6.
 *   - Метка-цифра, которую видит игрок, = (позиция в круге) + 1.
 */
const PAGE_LABELS = [1, 2, 3, 4, 5, 6] as const

const GRID_AREA: Record<number, string> = {
  1: 'top',
  2: 'bottomLeft',
  3: 'bottomRight',
  4: 'topLeft',
  5: 'topRight',
  6: 'bottom',
}

export function SkillRunesTab({ runes }: Props) {
  if (!runes.slots.length) {
    return <p className={styles.empty}>Все слоты рун пусты</p>
  }

  const sorted = [...runes.slots].sort((a, b) => a.slot - b.slot)
  const page1 = sorted.filter((s) => s.slot < 6)
  const page2 = sorted.filter((s) => s.slot >= 6)

  return (
    <div className={styles.runesBoard}>
      <RunesPage title="Круг 1" slots={page1} pageOffset={0} />
      <RunesPage title="Круг 2" slots={page2} pageOffset={6} />
    </div>
  )
}

function RunesPage({
  title,
  slots,
  pageOffset,
}: {
  title: string
  slots: SkillRuneSlot[]
  pageOffset: number
}) {
  const byPosition = new Map<number, SkillRuneSlot>()
  for (const s of slots) {
    byPosition.set(s.slot - pageOffset, s)
  }
  return (
    <div className={styles.runesPage}>
      <h4 className={styles.runesPageTitle}>{title}</h4>
      <div className={styles.runesHex}>
        {PAGE_LABELS.map((label) => {
          const data = byPosition.get(label - 1)
          return (
            <div
              key={label}
              className={styles.runesHexCell}
              style={{ gridArea: GRID_AREA[label] }}
            >
              <RuneSlotCard label={label} slot={data} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RuneSlotCard({ label, slot }: { label: number; slot?: SkillRuneSlot }) {
  if (!slot) {
    return (
      <div
        className={`${styles.runeSlotCard} ${styles.runeSlotEmpty}`}
        title={`Слот ${label}: пусто`}
      >
        <span className={styles.runeSlotBadge}>{label}</span>
      </div>
    )
  }

  const skillTitle = slot.skillName ?? `skill #${slot.skillId}`
  const runeTitle =
    slot.runeItemName ?? (slot.runeTemplateId > 0 ? `руна #${slot.runeTemplateId}` : null)
  const runeIcon = slot.runeTemplateId > 0 ? itemIconUrl(slot.runeTemplateId) : undefined

  return (
    <div className={styles.runeSlotCard}>
      <HoverTooltip
        className={styles.runeSlotSkillTrigger}
        content={<SkillTooltipContent slot={slot} />}
      >
        {(slot.skillIconUpscale62 ?? slot.skillIcon) ? (
          <img
            className={styles.runeSlotSkillIcon}
            src={slot.skillIconUpscale62 ?? slot.skillIcon}
            alt={skillTitle}
            loading="lazy"
          />
        ) : (
          <span className={styles.runeSlotSkillFallback}>{skillTitle}</span>
        )}
      </HoverTooltip>
      {runeIcon && (
        <HoverTooltip
          className={styles.runeSlotRuneTrigger}
          content={<RuneTooltipContent slot={slot} />}
        >
          <img
            className={styles.runeSlotRuneIcon}
            src={runeIcon}
            alt={runeTitle ?? ''}
            loading="lazy"
          />
        </HoverTooltip>
      )}
    </div>
  )
}

function SkillTooltipContent({ slot }: { slot: SkillRuneSlot }) {
  let decodedDesc = decodeUnicodeEscapes(slot.skillDescription ?? undefined)
  if (decodedDesc) {
    const runeLevel = extractRuneLevel(slot.runeItemName)
    decodedDesc = processRuneSkillDescription(decodedDesc, runeLevel)
  }

  // PW кладёт имя скила первой строкой описания (с правильным ^rrggbb-цветом).
  // Используем её как «хедер» tooltip-а; отдельно slot.skillNameColored
  // больше не выводим, чтобы не было дубля. Если описания нет совсем —
  // fallback на slot.skillNameColored / slot.skillName.
  let header: string
  let body: string
  if (decodedDesc) {
    const sepRe = /\\r|\r\n|\r|\n/
    const idx = decodedDesc.search(sepRe)
    if (idx >= 0) {
      header = decodedDesc.slice(0, idx)
      // Срезаем все ведущие разделители — vertical-gap делает CSS (`.skillTooltipBody.gap`),
      // дублировать его пустыми строками не нужно.
      body = decodedDesc.slice(idx).replace(/^(?:\\r|\r\n|\r|\n)+/, '')
    } else {
      header = decodedDesc
      body = ''
    }
  } else {
    header = decodeUnicodeEscapes(slot.skillNameColored ?? slot.skillName ?? '') ?? ''
    body = ''
  }

  return (
    <div className={styles.skillTooltipBody}>
      {header && <ItemDescription text={header} className={styles.skillTooltipName} />}
      {body && <ItemDescription text={body} className={styles.skillTooltipDesc} />}
    </div>
  )
}

/**
 * Парсер скилл-описаний с рунными блоками `@1...@1` и `@2...@2`.
 *
 *   - `@1...@1` — «таблица значений по уровням руны» (1-4, 5-7, 8-9, 10).
 *     Из строки, попадающей в уровень текущей руны, вытаскиваем числа,
 *     которые потом подставим вместо `%d`/`%.Nf` в `@2`. Сам блок выкидываем.
 *
 *   - `@2...@2` — финальный prose-текст с одним или несколькими
 *     плейсхолдерами `%d` (целое) и `%.<N>f` (float с N знаков после .).
 *     Маркеры `@2` снимаем.
 *
 *   - `%%` — игровой эскейп для литерального `%`, заменяем на `%`.
 *
 * Стратегия извлечения значений из @1 — двухступенчатая (см.
 * {@link extractRuneValues}): regex по @2-шаблону → fallback на «вытащить
 * все числа, выкинуть фиксированные».
 */
function processRuneSkillDescription(raw: string, runeLevel?: number): string {
  if (!raw) return raw
  if (raw.indexOf('@1') < 0 && raw.indexOf('@2') < 0) {
    return collapsePercentEscapes(raw)
  }

  const at1Match = raw.match(/@1([\s\S]*?)@1/)
  const at2Match = raw.match(/@2([\s\S]*?)@2/)

  let values: string[] = []
  if (at1Match && at2Match && runeLevel !== undefined) {
    const at1Line = findLevelLine(at1Match[1], runeLevel)
    if (at1Line !== null) {
      values = extractRuneValues(at2Match[1], at1Line)
    }
  }

  // Срезаем @1-блок (он только источник значений, в UI его не показываем)
  let processed = raw.replace(/@1[\s\S]*?@1/g, '')

  // Подставляем значения в @2 один за другим: первый плейсхолдер ← values[0],
  // второй ← values[1] и т.д. Маркеры @2 снимаем.
  //
  // ВАЖНО: дробную часть НЕ режем — у PW формат `%d` далеко не всегда
  // строго integer. Например, у изумрудной руны для скила «получение ци»
  // в @1 значение «0,2», и шаблон `%d сотых ци` ожидает подставить
  // именно «0,2», а не «0». Если же regex/fallback извлёк целое число
  // (например, «4» из строки «0,4» — там literal-`0,` уже стоит в шаблоне),
  // то и подставится «4» — никакого мусора не появится.
  processed = processed.replace(/@2([\s\S]*?)@2/g, (_, block: string) => {
    let i = 0
    return block.replace(/%\.\d+f|%d/g, (placeholder) => {
      if (i >= values.length) return placeholder
      return values[i++]
    })
  })

  return collapsePercentEscapes(processed)
}

/**
 * `%%` → `%` (игровой эскейп). Повторяем до стабилизации: на «20%%%»
 * один проход даёт «20%%», что всё ещё содержит лишний escape;
 * нужно ещё один проход → «20%». Завершается за O(N) проходов, где N —
 * максимальная длина непрерывной серии `%`. На реальных описаниях ≤ 3.
 */
function collapsePercentEscapes(text: string): string {
  let prev: string
  let cur = text
  do {
    prev = cur
    cur = cur.replace(/%%/g, '%')
  } while (cur !== prev)
  return cur
}

/**
 * Уровень руны из её имени: `«Золотая руна 10 ур.»` → `10`.
 */
function extractRuneLevel(name?: string): number | undefined {
  if (!name) return undefined
  const m = name.match(/(\d+)\s*ур\.?/)
  return m ? parseInt(m[1], 10) : undefined
}

/**
 * Находит в @1-блоке «entry» уровня руны: от строки с уровневым маркером
 * («1-4 ур.:» / «10 ур.:») до следующего такого маркера или конца блока.
 *
 * Важно держать ВСЕ строки entry, а не одну: у некоторых скиллов уровневая
 * запись разбита на несколько строк (например, «персонажам наносится X%»
 * и на следующей «монстрам - Y%»), и нам нужны оба числа.
 *
 * Возвращает текст entry с сохранёнными PW-цвет-кодами — extractor сам их снимет.
 */
function findLevelLine(block: string, level: number): string | null {
  const lines = block.split(/\\r|\r\n|\r|\n/)
  const markerRe = /(\d+)(?:\s*-\s*(\d+))?\s*ур\.:/

  // Индексы строк, начинающихся с (или содержащих) уровневый маркер.
  const markerIdxs: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (markerRe.test(stripPwColors(lines[i]))) markerIdxs.push(i)
  }

  for (let mi = 0; mi < markerIdxs.length; mi++) {
    const startLine = markerIdxs[mi]
    const stripped = stripPwColors(lines[startLine])
    const range = stripped.match(/(\d+)\s*-\s*(\d+)\s*ур\.:/)
    let matches = false
    if (range) {
      const lo = parseInt(range[1], 10)
      const hi = parseInt(range[2], 10)
      matches = level >= lo && level <= hi
    } else {
      const single = stripped.match(/(\d+)\s*ур\.:/)
      if (single) matches = parseInt(single[1], 10) === level
    }
    if (!matches) continue

    const endLine = mi + 1 < markerIdxs.length ? markerIdxs[mi + 1] : lines.length
    return lines.slice(startLine, endLine).join('\n')
  }
  return null
}

/**
 * Извлекает значения для подстановки в `%d`/`%.Nf` из @1-строки.
 * Двухступенчато:
 *
 *   1. **Regex по @2-шаблону.** Превращаем `%d` → `(\d+)`, `%.Nf` →
 *      `(\d+(?:[,.]\d{1,N})?)`, остальное — литерал с lenient-whitespace.
 *      Работает, когда @1 ↔ @2 по prose совпадают (отличаются только числа):
 *      это случай «0,%d» / «0,4», «%.1f сек.» / «3,5 сек.», и т.п.
 *
 *   2. **Fallback: вытащить все числа из @1, выкинуть те, что есть в @2.**
 *      Работает, когда @1 и @2 написаны разными словами (silver-rune
 *      пример: @1 «дополнительно добавляется до X%», @2 «увеличивается
 *      максимум на %d%»).
 *
 * Если оба способа дали меньше значений, чем плейсхолдеров — берём
 * максимум и оставляем хвост плейсхолдеров неподставленным.
 */
function extractRuneValues(at2Block: string, at1Line: string): string[] {
  const t = stripPwColors(at2Block).replace(/%%/g, '%')
  const s = stripPwColors(at1Line).replace(/%%/g, '%')

  const phMatches = t.match(/%\.\d+f|%d/g) ?? []
  if (phMatches.length === 0) return []

  const byRegex = tryTemplateRegex(t, s)
  if (byRegex.length >= phMatches.length) return byRegex

  const byFallback = extractByDiffFromTemplate(t, s)
  return byFallback.length >= byRegex.length ? byFallback : byRegex
}

/** Снимаем PW-цвет-коды `^rrggbb`. */
function stripPwColors(text: string): string {
  return text.replace(/\^[0-9a-fA-F]{6}/g, '')
}

/**
 * Строит regex из @2-шаблона: плейсхолдеры → capture-группы, остальное —
 * литерал с lenient-whitespace и `[,;]`-взаимозаменяемой пунктуацией.
 * Не якорим хвост — пусть совпадение возможно даже если @1-строка чуть
 * длиннее или обрезана.
 */
function tryTemplateRegex(template: string, sample: string): string[] {
  const phRe = /%\.(\d+)f|%d/g
  let pat = ''
  let lastIdx = 0
  let m: RegExpExecArray | null

  while ((m = phRe.exec(template)) !== null) {
    pat += escapeForLeniency(template.slice(lastIdx, m.index))
    if (m[0].startsWith('%.')) {
      const n = parseInt(m[1], 10)
      pat += `(\\d+(?:[,.]\\d{1,${n}})?)`
    } else {
      // `%d` в PW не всегда строго integer: бывают шаблоны типа
      // `%d сотых ци`, в которые подставляется «0,2». Захватываем
      // десятичные тоже, опционально.
      pat += `(\\d+(?:[,.]\\d+)?)`
    }
    lastIdx = phRe.lastIndex
  }
  if (!pat) return []

  try {
    const re = new RegExp(pat, 'i')
    const match = sample.match(re)
    if (!match) return []
    return match.slice(1)
  } catch {
    return []
  }
}

function escapeForLeniency(str: string): string {
  return str
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
    .replace(/[,;]/g, '[,;]')
}

/**
 * Fallback: вытаскиваем числа из @1 (отбрасывая префикс «N ур.:») и
 * выкидываем те, что встречаются как литералы в @2-шаблоне (фиксированные
 * константы вроде «2900», «5800»). Остаётся набор «вариативных» чисел —
 * это и есть значения для плейсхолдеров.
 */
function extractByDiffFromTemplate(template: string, sample: string): string[] {
  const numRe = /\d+(?:[,.]\d+)?/g

  const tNums: string[] = []
  let m: RegExpExecArray | null
  while ((m = numRe.exec(template)) !== null) tNums.push(m[0])

  numRe.lastIndex = 0
  const sNumsAll: { val: string; idx: number }[] = []
  while ((m = numRe.exec(sample)) !== null) sNumsAll.push({ val: m[0], idx: m.index })

  const urIdx = sample.indexOf('ур.:')
  const sNums = sNumsAll
    .filter((n) => urIdx < 0 || n.idx > urIdx)
    .map((n) => n.val)

  const remaining = [...sNums]
  for (const fix of tNums) {
    const i = remaining.indexOf(fix)
    if (i >= 0) remaining.splice(i, 1)
  }
  return remaining
}

function RuneTooltipContent({ slot }: { slot: SkillRuneSlot }) {
  // У items нет NameColored — есть только Name + NameColor (HEX-строка).
  // Заголовок раскрашиваем через inline-style, описание — через ItemDescription.
  const name = decodeUnicodeEscapes(slot.runeItemName ?? '') ?? ''
  const decodedDesc = decodeUnicodeEscapes(slot.runeItemDescription ?? undefined)
  const nameStyle = slot.runeItemNameColor
    ? { color: `#${slot.runeItemNameColor}` }
    : undefined
  return (
    <div className={styles.skillTooltipBody}>
      <div className={styles.skillTooltipName} style={nameStyle}>{name}</div>
      {decodedDesc && (
        <ItemDescription text={decodedDesc} className={styles.skillTooltipDesc} />
      )}
    </div>
  )
}
