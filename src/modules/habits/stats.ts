import { MONTHS, toISODate } from '../../core/dates'
import type { Habit, HabitLog } from '../../core/types'

/** Mes del calendario. `month` va de 0 (enero) a 11 (diciembre). */
export interface MonthRef {
  year: number
  month: number
}

export type CellState = 'done' | 'open' | 'off' | 'future'

export interface HabitColumn {
  habit: Habit
  cells: CellState[]
  /** Días cumplidos en el mes. */
  done: number
  /** Días que corresponden contar: desde el inicio del mes hasta hoy (o hasta que se quitó el hábito). */
  outOf: number
}

export interface MonthView {
  days: string[]
  columns: HabitColumn[]
  /** Hábitos cumplidos por día; null en los días que todavía no llegaron. */
  perDay: (number | null)[]
  /** Promedio de hábitos cumplidos por día, o null si el mes no empezó. */
  average: number | null
  /** Cantidad de días contados. */
  elapsed: number
}

const pad = (n: number) => String(n).padStart(2, '0')

export const monthRefOf = (iso: string): MonthRef => ({ year: +iso.slice(0, 4), month: +iso.slice(5, 7) - 1 })

export const monthKey = ({ year, month }: MonthRef) => `${year}-${pad(month + 1)}`

export function shiftMonth({ year, month }: MonthRef, delta: number): MonthRef {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}

export const monthLabel = ({ year, month }: MonthRef) => `${MONTHS[month]} ${year}`

export function daysOfMonth({ year, month }: MonthRef): string[] {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => toISODate(new Date(year, month, i + 1)))
}

/** Un hábito aparece desde el mes en que se creó hasta el mes en que se quitó (inclusive). */
export function habitVisibleIn(habit: Habit, ref: MonthRef): boolean {
  if (habit.deletedAt) return false
  const key = monthKey(ref)
  return habit.createdOn.slice(0, 7) <= key && (!habit.archivedOn || habit.archivedOn.slice(0, 7) >= key)
}

export function buildMonth(ref: MonthRef, habits: Habit[], logs: HabitLog[], today: string): MonthView {
  const days = daysOfMonth(ref)
  const key = monthKey(ref)
  const lastCounted = today < days[0] ? null : today < days[days.length - 1] ? today : days[days.length - 1]
  const elapsed = lastCounted ? days.indexOf(lastCounted) + 1 : 0

  const doneSet = new Set(logs.filter((l) => !l.deletedAt && l.date.startsWith(key)).map((l) => `${l.habitId}:${l.date}`))

  const visible = habits
    .filter((h) => habitVisibleIn(h, ref))
    .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))

  const columns: HabitColumn[] = visible.map((habit) => {
    const archivedThisMonth = habit.archivedOn && habit.archivedOn.slice(0, 7) === key ? habit.archivedOn : null
    const cells = days.map((day): CellState => {
      if (doneSet.has(`${habit.id}:${day}`)) return 'done'
      if (day > today) return 'future'
      if (archivedThisMonth && day > archivedThisMonth) return 'off'
      return 'open'
    })
    const done = cells.filter((c) => c === 'done').length
    const start = habit.createdOn.startsWith(key) ? habit.createdOn : days[0]
    const end = archivedThisMonth && archivedThisMonth < (lastCounted ?? '') ? archivedThisMonth : lastCounted
    const window = end ? days.filter((d) => d >= start && d <= end).length : 0
    return { habit, cells, done, outOf: Math.max(window, done) }
  })

  const perDay = days.map((day, i) => (day > today ? null : columns.filter((c) => c.cells[i] === 'done').length))
  const counted = perDay.filter((n): n is number => n !== null)
  const average = counted.length ? counted.reduce((a, b) => a + b, 0) / counted.length : null

  return { days, columns, perDay, average, elapsed }
}
