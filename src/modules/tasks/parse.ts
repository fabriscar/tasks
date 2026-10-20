import { addDays, addMonths, fromISODate, toISODate, todayISO, weekdayOf } from '../../core/dates'
import { firstWeekdayOnOrAfter } from '../../core/recurrence'
import type { Priority, Repeat } from '../../core/types'

export interface ParsedTask {
  title: string
  dueDate: string | null
  dueTime: string | null
  priority: Priority
  tags: string[]
  repeat: Repeat | null
}

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}
const WD = 'domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado'
const MONTH_INDEX: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
}
const MONTH = Object.keys(MONTH_INDEX).join('|')

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

/** Regex que exige que el patrón no esté pegado a otras letras o números (el \b de JS no entiende acentos). */
const rx = (src: string) => new RegExp(`(?<![\\p{L}\\d])(?:${src})(?![\\p{L}\\d])`, 'iu')

/** Saca la primera coincidencia del texto y la devuelve junto con el texto restante. */
function take(text: string, re: RegExp): [RegExpMatchArray | null, string] {
  const m = text.match(re)
  if (!m || m.index === undefined) return [null, text]
  return [m, `${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`]
}

function parseRepeat(text: string): { repeat: Repeat | null; text: string } {
  let m: RegExpMatchArray | null
  let rest: string

  ;[m, rest] = take(text, rx(`(?:cada|todos los) ((?:${WD})(?:\\s*(?:,|y|e)\\s*(?:${WD}))*)`))
  if (m) {
    const days = [...new Set(norm(m[1]).match(/domingo|lunes|martes|miercoles|jueves|viernes|sabado/g) ?? [])]
    return { repeat: { unit: 'week', interval: 1, weekdays: days.map((d) => WEEKDAY_INDEX[d]) }, text: rest }
  }
  ;[m, rest] = take(text, rx('cada (\\d+) d[ií]as'))
  if (m) return { repeat: { unit: 'day', interval: Math.max(1, +m[1]) }, text: rest }
  ;[m, rest] = take(text, rx('todos los d[ií]as|cada d[ií]a|a diario|diariamente|diario'))
  if (m) return { repeat: { unit: 'day', interval: 1 }, text: rest }
  ;[m, rest] = take(text, rx('cada (\\d+) semanas'))
  if (m) return { repeat: { unit: 'week', interval: Math.max(1, +m[1]) }, text: rest }
  ;[m, rest] = take(text, rx('cada semana|todas las semanas|semanalmente|semanal'))
  if (m) return { repeat: { unit: 'week', interval: 1 }, text: rest }
  ;[m, rest] = take(text, rx('cada (\\d+) meses'))
  if (m) return { repeat: { unit: 'month', interval: Math.max(1, +m[1]) }, text: rest }
  ;[m, rest] = take(text, rx('cada mes|todos los meses|mensualmente|mensual'))
  if (m) return { repeat: { unit: 'month', interval: 1 }, text: rest }
  return { repeat: null, text }
}

function parseTime(text: string): { time: string | null; text: string } {
  const patterns = [
    '(?<pre>a las?) (?<h>\\d{1,2})(?::(?<m>\\d{2}))?\\s*(?<ap>am|pm|hs|h)?(?:\\s+de la (?<pd>ma[ñn]ana|tarde|noche))?',
    '(?<h>\\d{1,2}):(?<m>\\d{2})\\s*(?<ap>am|pm|hs|h)?',
    '(?<h>\\d{1,2})\\s*(?<ap>am|pm|hs)',
  ]
  for (const p of patterns) {
    const [m, rest] = take(text, rx(p))
    if (!m?.groups) continue
    let h = +m.groups.h
    const min = m.groups.m ? +m.groups.m : 0
    const ap = m.groups.ap?.toLowerCase()
    const pd = m.groups.pd ? norm(m.groups.pd) : undefined
    if ((ap === 'pm' || pd === 'tarde' || pd === 'noche') && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    if (h > 23 || min > 59) continue
    return { time: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, text: rest }
  }
  return { time: null, text }
}

function parseDate(text: string, today: string): { date: string | null; text: string } {
  let m: RegExpMatchArray | null
  let rest: string
  const year = fromISODate(today).getFullYear()

  ;[m, rest] = take(text, rx('pasado ma[ñn]ana'))
  if (m) return { date: addDays(today, 2), text: rest }
  ;[m, rest] = take(text, rx('ma[ñn]ana'))
  if (m) return { date: addDays(today, 1), text: rest }
  ;[m, rest] = take(text, rx('hoy|esta noche|esta tarde'))
  if (m) return { date: today, text: rest }

  ;[m, rest] = take(text, rx('en (\\d+) (d[ií]as?|semanas?|mes(?:es)?)'))
  if (m) {
    const n = +m[1]
    const unit = norm(m[2])
    if (unit.startsWith('d')) return { date: addDays(today, n), text: rest }
    if (unit.startsWith('s')) return { date: addDays(today, n * 7), text: rest }
    return { date: addMonths(today, n), text: rest }
  }

  ;[m, rest] = take(text, rx(`(?:el )?(\\d{1,2}) de (${MONTH})(?: de (\\d{4}))?`))
  if (m) {
    const date = buildDate(+m[1], MONTH_INDEX[norm(m[2])], m[3] ? +m[3] : undefined, today)
    if (date) return { date, text: rest }
  }

  ;[m, rest] = take(text, rx('(?:el )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2,4}))?'))
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : undefined
    const date = buildDate(+m[1], +m[2] - 1, y, today)
    if (date) return { date, text: rest }
  }

  ;[m, rest] = take(text, rx(`(?:(?:para )?el |este |pr[oó]ximo )?(${WD})`))
  if (m) {
    const target = WEEKDAY_INDEX[norm(m[1])]
    const ahead = (target - weekdayOf(today) + 7) % 7 || 7
    return { date: addDays(today, ahead), text: rest }
  }

  ;[m, rest] = take(text, rx('el (\\d{1,2})'))
  if (m) {
    const day = +m[1]
    if (day >= 1 && day <= 31) {
      const t = fromISODate(today)
      const monthOffset = day >= t.getDate() ? 0 : 1
      const first = new Date(year, t.getMonth() + monthOffset, 1)
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
      return { date: toISODate(new Date(first.getFullYear(), first.getMonth(), Math.min(day, last))), text: rest }
    }
  }

  return { date: null, text }
}

/** Arma una fecha válida; si no se indicó año y ya pasó, usa el año siguiente. */
function buildDate(day: number, month: number, yearGiven: number | undefined, today: string): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const year = yearGiven ?? fromISODate(today).getFullYear()
  const d = new Date(year, month, day)
  if (d.getMonth() !== month) return null
  let date = toISODate(d)
  if (yearGiven === undefined && date < today) date = toISODate(new Date(year + 1, month, day))
  return date
}

/** Largo máximo de una frase de captura. Acota el trabajo del parser y el tamaño de lo que se guarda. */
export const MAX_INPUT = 500

const TRAILING_CONNECTOR = /\s+(?:para|el|la|los|las|a|de|en|por|este|esta|pr[oó]ximo)\s*$/iu

function cleanTitle(text: string): string {
  let t = text.replace(/\s+/g, ' ').replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, '')
  while (TRAILING_CONNECTOR.test(t)) t = t.replace(TRAILING_CONNECTOR, '').replace(/[\s,.;:-]+$/g, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/**
 * Interpreta una frase escrita a las apuradas.
 * Ej: "Pagar la luz mañana a las 18 !alta #casa" o "Regar plantas cada lunes y jueves".
 */
export function parseQuickTask(input: string, now: Date = new Date()): ParsedTask {
  const today = todayISO(now)
  input = input.slice(0, MAX_INPUT)
  let text = input

  const tags: string[] = []
  text = text.replace(/(?<![\p{L}\d])#([\p{L}\d_-]+)/gu, (_all, tag: string) => {
    const lower = tag.toLowerCase()
    if (!tags.includes(lower)) tags.push(lower)
    return ' '
  })

  let priority: Priority = 0
  const [pm, afterPriority] = take(text, rx('!(alta|media|baja|[123])'))
  if (pm) {
    const v = norm(pm[1])
    priority = v === 'alta' || v === '3' ? 3 : v === 'media' || v === '2' ? 2 : 1
    text = afterPriority
  }

  const rep = parseRepeat(text)
  text = rep.text
  const time = parseTime(text)
  text = time.text
  const date = parseDate(text, today)
  text = date.text

  let dueDate = date.date
  if (rep.repeat && !dueDate) {
    dueDate = rep.repeat.weekdays?.length ? firstWeekdayOnOrAfter(rep.repeat.weekdays, today) : today
  }

  return {
    title: cleanTitle(text) || input.trim(),
    dueDate,
    dueTime: time.time,
    priority,
    tags,
    repeat: rep.repeat,
  }
}
