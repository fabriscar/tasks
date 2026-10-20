import { addDays, addMonths, diffDays, weekdayOf, WEEKDAYS } from './dates'
import type { Repeat } from './types'

const weekStart = (s: string) => addDays(s, -((weekdayOf(s) + 6) % 7)) // lunes

function step(rule: Repeat, from: string): string {
  if (rule.unit === 'day') return addDays(from, rule.interval)
  if (rule.unit === 'month') return addMonths(from, rule.interval)
  if (rule.weekdays?.length) {
    const base = weekStart(from)
    for (let i = 1; i <= 7 * rule.interval + 7; i++) {
      const candidate = addDays(from, i)
      if (!rule.weekdays.includes(weekdayOf(candidate))) continue
      if (Math.round(diffDays(base, weekStart(candidate)) / 7) % rule.interval === 0) return candidate
    }
  }
  return addDays(from, 7 * rule.interval)
}

/** Próxima fecha de la regla, posterior a `from` y también posterior a `after` (para no crear tareas ya vencidas). */
export function nextOccurrence(rule: Repeat, from: string, after: string): string {
  let next = step(rule, from)
  for (let i = 0; next <= after && i < 1000; i++) next = step(rule, next)
  return next
}

/** Primer día desde `from` (inclusive) que cae en alguno de los días de la semana. */
export function firstWeekdayOnOrAfter(weekdays: number[], from: string): string {
  for (let i = 0; i < 7; i++) {
    const c = addDays(from, i)
    if (weekdays.includes(weekdayOf(c))) return c
  }
  return from
}

export function repeatLabel(rule: Repeat): string {
  const n = rule.interval
  if (rule.unit === 'day') return n === 1 ? 'Todos los días' : `Cada ${n} días`
  if (rule.unit === 'month') return n === 1 ? 'Todos los meses' : `Cada ${n} meses`
  if (rule.weekdays?.length) {
    const names = [...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAYS[d])
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0]
    return n === 1 ? `Cada ${list}` : `Cada ${n} semanas: ${list}`
  }
  return n === 1 ? 'Todas las semanas' : `Cada ${n} semanas`
}
