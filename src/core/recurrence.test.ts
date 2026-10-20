import { describe, expect, it } from 'vitest'
import { nextOccurrence, repeatLabel } from './recurrence'
import type { Repeat } from './types'

describe('nextOccurrence', () => {
  it('avanza por días', () => {
    expect(nextOccurrence({ unit: 'day', interval: 1 }, '2026-10-19', '2026-10-19')).toBe('2026-10-20')
    expect(nextOccurrence({ unit: 'day', interval: 3 }, '2026-10-19', '2026-10-19')).toBe('2026-10-22')
  })

  it('salta a una fecha futura si la tarea estaba atrasada', () => {
    expect(nextOccurrence({ unit: 'day', interval: 1 }, '2026-10-10', '2026-10-19')).toBe('2026-10-20')
  })

  it('respeta los días de la semana', () => {
    const rule: Repeat = { unit: 'week', interval: 1, weekdays: [1, 4] }
    expect(nextOccurrence(rule, '2026-10-19', '2026-10-19')).toBe('2026-10-22') // lunes -> jueves
    expect(nextOccurrence(rule, '2026-10-22', '2026-10-22')).toBe('2026-10-26') // jueves -> lunes
  })

  it('respeta el intervalo en semanas con días específicos', () => {
    const rule: Repeat = { unit: 'week', interval: 2, weekdays: [1] }
    expect(nextOccurrence(rule, '2026-10-19', '2026-10-19')).toBe('2026-11-02')
  })

  it('avanza por semanas y meses, sin pasarse de fin de mes', () => {
    expect(nextOccurrence({ unit: 'week', interval: 1 }, '2026-10-19', '2026-10-19')).toBe('2026-10-26')
    expect(nextOccurrence({ unit: 'month', interval: 1 }, '2026-01-31', '2026-01-31')).toBe('2026-02-28')
  })
})

describe('repeatLabel', () => {
  it('describe la regla en español', () => {
    expect(repeatLabel({ unit: 'day', interval: 1 })).toBe('Todos los días')
    expect(repeatLabel({ unit: 'week', interval: 1, weekdays: [4, 1] })).toBe('Cada lunes y jueves')
    expect(repeatLabel({ unit: 'week', interval: 2 })).toBe('Cada 2 semanas')
  })
})
