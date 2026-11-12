import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../../core/types'
import { buildMonth, daysOfMonth, habitVisibleIn, monthLabel, shiftMonth } from './stats'

const habit = (over: Partial<Habit> & { id: string }): Habit => ({
  name: over.id,
  position: 0,
  createdOn: '2026-11-01',
  archivedOn: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  deletedAt: null,
  dirty: 0,
  ...over,
})

const log = (habitId: string, date: string, deletedAt: string | null = null): HabitLog => ({
  id: `${habitId}:${date}`,
  habitId,
  date,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  deletedAt,
  dirty: 0,
})

const nov = { year: 2026, month: 10 }

describe('calendario', () => {
  it('arma los días del mes y navega entre meses', () => {
    expect(daysOfMonth(nov)).toHaveLength(30)
    expect(daysOfMonth({ year: 2028, month: 1 })).toHaveLength(29)
    expect(shiftMonth(nov, 2)).toEqual({ year: 2027, month: 0 })
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 })
    expect(monthLabel(nov)).toBe('noviembre 2026')
  })
})

describe('habitVisibleIn', () => {
  it('aparece desde el mes de creación y hasta el mes en que se quitó', () => {
    const h = habit({ id: 'a', createdOn: '2026-10-01', archivedOn: '2026-11-09' })
    expect(habitVisibleIn(h, { year: 2026, month: 8 })).toBe(false)
    expect(habitVisibleIn(h, { year: 2026, month: 9 })).toBe(true)
    expect(habitVisibleIn(h, nov)).toBe(true)
    expect(habitVisibleIn(h, { year: 2026, month: 11 })).toBe(false)
  })

  it('no muestra los borrados', () => {
    expect(habitVisibleIn(habit({ id: 'a', deletedAt: '2026-11-02T00:00:00.000Z' }), nov)).toBe(false)
  })
})

describe('buildMonth', () => {
  const habits = [habit({ id: 'leer', position: 0 }), habit({ id: 'gym', position: 1 })]
  const logs = [log('leer', '2026-11-01'), log('leer', '2026-11-02'), log('gym', '2026-11-02'), log('leer', '2026-11-03', '2026-11-03T10:00:00.000Z')]

  it('cuenta lo cumplido por hábito y por día hasta hoy', () => {
    const m = buildMonth(nov, habits, logs, '2026-11-09')
    expect(m.elapsed).toBe(9)
    expect(m.columns.map((c) => [c.habit.id, c.done, c.outOf])).toEqual([
      ['leer', 2, 9],
      ['gym', 1, 9],
    ])
    expect(m.perDay.slice(0, 4)).toEqual([1, 2, 0, 0])
  })

  it('un día desmarcado (borrado lógico) no cuenta', () => {
    const m = buildMonth(nov, habits, logs, '2026-11-09')
    expect(m.columns[0].cells[2]).toBe('open')
  })

  it('los días futuros no tienen punto ni se pueden marcar', () => {
    const m = buildMonth(nov, habits, logs, '2026-11-09')
    expect(m.perDay[9]).toBeNull()
    expect(m.columns[0].cells[9]).toBe('future')
  })

  it('calcula el promedio de hábitos por día', () => {
    const m = buildMonth(nov, habits, [log('leer', '2026-11-01'), log('gym', '2026-11-01'), log('leer', '2026-11-02')], '2026-11-02')
    expect(m.average).toBe(1.5)
  })

  it('un mes pasado cuenta todos sus días y un mes futuro ninguno', () => {
    const past = buildMonth({ year: 2026, month: 10 }, habits, logs, '2026-12-15')
    expect(past.elapsed).toBe(30)
    expect(past.columns[0].outOf).toBe(30)
    const future = buildMonth({ year: 2027, month: 2 }, [habit({ id: 'a', createdOn: '2026-11-01' })], [], '2026-11-09')
    expect(future.elapsed).toBe(0)
    expect(future.average).toBeNull()
  })

  it('un hábito quitado deja de contar y de marcarse después de ese día', () => {
    const m = buildMonth(nov, [habit({ id: 'x', archivedOn: '2026-11-05' })], [log('x', '2026-11-04')], '2026-11-09')
    expect(m.columns[0].outOf).toBe(5)
    expect(m.columns[0].cells.slice(3, 7)).toEqual(['done', 'open', 'off', 'off'])
  })

  it('ignora lo cumplido en otros meses', () => {
    const m = buildMonth(nov, habits, [log('leer', '2026-10-31')], '2026-11-09')
    expect(m.columns[0].done).toBe(0)
  })
})
