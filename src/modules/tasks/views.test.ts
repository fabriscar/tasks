import { describe, expect, it } from 'vitest'
import type { Task } from '../../core/types'
import { buildViews } from './views'

const t = (over: Partial<Task>): Task => ({
  id: Math.random().toString(),
  title: 'x',
  notes: '',
  dueDate: null,
  dueTime: null,
  priority: 0,
  tags: [],
  repeat: null,
  doneAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  dirty: 0,
  ...over,
})

describe('buildViews', () => {
  const today = '2026-10-19'

  it('separa atrasadas, hoy, próximas y bandeja', () => {
    const v = buildViews(
      [
        t({ id: 'a', dueDate: '2026-10-17' }),
        t({ id: 'b', dueDate: today, dueTime: '18:00' }),
        t({ id: 'c', dueDate: today, dueTime: '09:00' }),
        t({ id: 'd', dueDate: '2026-10-21' }),
        t({ id: 'e' }),
        t({ id: 'f', dueDate: today, deletedAt: '2026-10-18T00:00:00.000Z' }),
      ],
      today,
    )
    expect(v.overdue.map((x) => x.id)).toEqual(['a'])
    expect(v.today.map((x) => x.id)).toEqual(['c', 'b'])
    expect(v.upcoming.map((g) => g.date)).toEqual(['2026-10-21'])
    expect(v.inbox.map((x) => x.id)).toEqual(['e'])
    expect(v.pendingNow).toBe(3)
  })

  it('manda las hechas a su lista y no las cuenta como pendientes', () => {
    const doneAt = new Date(2026, 9, 19, 9, 0).toISOString()
    const v = buildViews([t({ id: 'a', dueDate: today, doneAt })], today)
    expect(v.today).toEqual([])
    expect(v.doneToday.map((x) => x.id)).toEqual(['a'])
    expect(v.done.map((x) => x.id)).toEqual(['a'])
    expect(v.pendingNow).toBe(0)
  })
})
