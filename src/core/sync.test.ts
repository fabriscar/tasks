import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { syncOnce, toRemote, type Remote, type RemoteTask } from './sync'
import type { Task } from './types'

const USER = 'user-1'

function fakeServer() {
  const rows = new Map<string, RemoteTask>()
  let clock = Date.parse('2026-10-19T12:00:00.000Z')
  const remote: Remote = {
    async push(batch) {
      for (const r of batch) {
        clock += 1000
        rows.set(r.id, { ...r, synced_at: new Date(clock).toISOString().replace('Z', '123+00:00') })
      }
    },
    async pull(since) {
      return [...rows.values()]
        .filter((r) => !since || Date.parse(r.synced_at!.replace(/(\.\d{3})\d+/, '$1')) > Date.parse(since))
        .sort((a, b) => a.synced_at!.localeCompare(b.synced_at!))
    },
  }
  return { rows, remote }
}

const task = (over: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title: 'Tarea',
  notes: '',
  dueDate: null,
  dueTime: null,
  priority: 0,
  tags: [],
  repeat: null,
  doneAt: null,
  createdAt: '2026-10-19T10:00:00.000Z',
  updatedAt: '2026-10-19T10:00:00.000Z',
  deletedAt: null,
  dirty: 1,
  ...over,
})

beforeEach(async () => {
  await db.tasks.clear()
  await db.meta.clear()
})

describe('syncOnce', () => {
  it('sube las tareas pendientes y las marca como sincronizadas', async () => {
    const { rows, remote } = fakeServer()
    const t = task()
    await db.tasks.add(t)

    const result = await syncOnce(remote, USER)

    expect(result.pushed).toBe(1)
    expect(rows.get(t.id)?.title).toBe('Tarea')
    expect((await db.tasks.get(t.id))?.dirty).toBe(0)
  })

  it('baja las tareas creadas en otro dispositivo', async () => {
    const { rows, remote } = fakeServer()
    const other = task({ title: 'Desde la compu' })
    rows.set(other.id, { ...toRemote(other, USER), synced_at: '2026-10-19T12:00:05.000000+00:00' })

    await syncOnce(remote, USER)

    expect((await db.tasks.get(other.id))?.title).toBe('Desde la compu')
    expect((await db.tasks.get(other.id))?.dirty).toBe(0)
  })

  it('ante un conflicto gana la edición más reciente', async () => {
    const { rows, remote } = fakeServer()
    const base = task({ title: 'Original', dirty: 0 })
    await db.tasks.add(base)
    rows.set(base.id, {
      ...toRemote({ ...base, title: 'Editada en la compu', updatedAt: '2026-10-19T11:00:00.000Z' }, USER),
      synced_at: '2026-10-19T12:00:05.000000+00:00',
    })
    // el celular editó después
    await db.tasks.update(base.id, { title: 'Editada en el celu', updatedAt: '2026-10-19T11:30:00.000Z', dirty: 1 })

    await syncOnce(remote, USER)

    expect((await db.tasks.get(base.id))?.title).toBe('Editada en el celu')
    expect(rows.get(base.id)?.title).toBe('Editada en el celu')
  })

  it('propaga los borrados', async () => {
    const { rows, remote } = fakeServer()
    const t = task({ dirty: 0 })
    await db.tasks.add(t)
    rows.set(t.id, {
      ...toRemote({ ...t, deletedAt: '2026-10-19T11:00:00.000Z', updatedAt: '2026-10-19T11:00:00.000Z' }, USER),
      synced_at: '2026-10-19T12:00:05.000000+00:00',
    })

    await syncOnce(remote, USER)

    expect((await db.tasks.get(t.id))?.deletedAt).toBe('2026-10-19T11:00:00.000Z')
  })

  it('no vuelve a subir lo que ya está sincronizado', async () => {
    const { remote } = fakeServer()
    await db.tasks.add(task())
    await syncOnce(remote, USER)
    const second = await syncOnce(remote, USER)
    expect(second.pushed).toBe(0)
  })
})
