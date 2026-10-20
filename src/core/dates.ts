const pad = (n: number) => String(n).padStart(2, '0')

export const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const todayISO = (now: Date = new Date()) => toISODate(now)

export function addDays(s: string, n: number): string {
  const d = fromISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Suma meses sin pasarse de fin de mes (31 ene + 1 mes = 28/29 feb). */
export function addMonths(s: string, n: number): string {
  const d = fromISODate(s)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toISODate(d)
}

export const weekdayOf = (s: string) => fromISODate(s).getDay()

export const diffDays = (a: string, b: string) =>
  Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000)

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** "lunes 19 de octubre" */
export function longDate(s: string): string {
  const d = fromISODate(s)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`
}

/** "Hoy", "Mañana", "Ayer", "Jueves", "25 oct" */
export function relativeDate(s: string, today: string): string {
  const diff = diffDays(today, s)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff === -1) return 'Ayer'
  if (diff > 1 && diff < 7) return capitalize(WEEKDAYS[weekdayOf(s)])
  const d = fromISODate(s)
  const label = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  return d.getFullYear() === fromISODate(today).getFullYear() ? label : `${label} ${d.getFullYear()}`
}

/** Encabezado de grupo: "Mañana", "Jueves 22", "3 nov" */
export function groupDate(s: string, today: string): string {
  const diff = diffDays(today, s)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff > 1 && diff < 7) return `${capitalize(WEEKDAYS[weekdayOf(s)])} ${fromISODate(s).getDate()}`
  return relativeDate(s, today)
}
