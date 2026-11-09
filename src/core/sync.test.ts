import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { tasksSync } from '../modules/tasks/sync'
import { dayNotesSync, habitLogsSync, habitsSync } from '../modules/habits/sync'
import { claimLocalData, syncOnce, type Remote, type RemoteRow } from './sync'
import type { Task } from './types'

const USER = 'user-1'

const TABLES = [tasksSync, habitsSync, habitLogsSync]
const toRemote = (t: Task, userId: string) => tasksSync.toRemote(t, userId)

function fakeServer() {
  const tables = new Map<string, Map<string, RemoteRow>>()
  const rowsOf = (table: string) => tables.get(table) ?? tables.set(table, new Map()).get(table)!
  let clock = Date.parse('2026-10-19T12:00:00.000Z')
  const remote: Remote = {
    async push(table, _conflict, batch) {
      for (const r of batch) {
        clock += 1000
        rowsOf(table).set(r.id, { ...r, synced_at: new Date(clock).toISOString().replace('Z', '123+00:00') })
      }
    },
    async pull(table, since) {
      return [...rowsOf(table).values()]
        .filter((r) => !since || Date.parse(r.synced_at!.replace(/(\.\d{3})\d+/, '$1')) > Date.parse(since))
        .sort((a, b) => a.synced_at!.localeCompare(b.synced_at!))
    },
  }
  return { rows: rowsOf('tasks'), rowsOf, remote }
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
  for (const table of db.tables) await table.clear()
})

describe('syncOnce', () => {
  it('sube las tareas pendientes y las marca como sincronizadas', async () => {
    const { rows, remote } = fakeServer()
    const t = task()
    await db.tasks.add(t)

    const result = await syncOnce(remote, USER, TABLES)

    expect(result.pushed).toBe(1)
    expect(rows.get(t.id)?.title).toBe('Tarea')
    expect((await db.tasks.get(t.id))?.dirty).toBe(0)
  })

  it('baja las tareas creadas en otro dispositivo', async () => {
    const { rows, remote } = fakeServer()
    const other = task({ title: 'Desde la compu' })
    rows.set(other.id, { ...toRemote(other, USER), synced_at: '2026-10-19T12:00:05.000000+00:00' })

    await syncOnce(remote, USER, TABLES)

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

    await syncOnce(remote, USER, TABLES)

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

    await syncOnce(remote, USER, TABLES)

    expect((await db.tasks.get(t.id))?.deletedAt).toBe('2026-10-19T11:00:00.000Z')
  })

  it('no vuelve a subir lo que ya está sincronizado', async () => {
    const { remote } = fakeServer()
    await db.tasks.add(task())
    await syncOnce(remote, USER, TABLES)
    const second = await syncOnce(remote, USER, TABLES)
    expect(second.pushed).toBe(0)
  })
})

describe('claimLocalData', () => {
  it('conserva las tareas locales cuando es la misma cuenta o la primera vez', async () => {
    await db.tasks.add(task({ title: 'Mía' }))
    await claimLocalData('user-1')
    await claimLocalData('user-1')
    expect(await db.tasks.count()).toBe(1)
  })

  it('descarta los datos de otra cuenta al cambiar de usuario', async () => {
    await db.tasks.add(task({ title: 'De la cuenta 1' }))
    await claimLocalData('user-1')
    await db.meta.put({ key: 'lastPull', value: '2026-10-19T12:00:00.000Z' })

    await claimLocalData('user-2')

    expect(await db.tasks.count()).toBe(0)
    expect(await db.meta.get('lastPull')).toBeUndefined()
    expect((await db.meta.get('owner'))?.value).toBe('user-2')
  })
})

describe('syncOnce con hábitos', () => {
  const habit = (over = {}) => ({
    id: crypto.randomUUID(),
    name: 'Leer',
    position: 0,
    createdOn: '2026-11-01',
    archivedOn: null,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    deletedAt: null,
    dirty: 1 as const,
    ...over,
  })

  it('sube y baja hábitos, días marcados y notas', async () => {
    const { rowsOf, remote } = fakeServer()
    const h = habit()
    await db.habits.add(h)
    await db.habitLogs.add({ id: `${h.id}:2026-11-02`, habitId: h.id, date: '2026-11-02', createdAt: h.createdAt, updatedAt: h.updatedAt, deletedAt: null, dirty: 1 })
    await syncOnce(remote, USER, [...TABLES, dayNotesSync])
    expect(rowsOf('habits').get(h.id)?.name).toBe('Leer')
    expect(rowsOf('habit_logs').get(`${h.id}:2026-11-02`)?.habit_id).toBe(h.id)

    // otro dispositivo: base vacía que baja todo
    for (const table of db.tables) await table.clear()
    await syncOnce(remote, USER, [...TABLES, dayNotesSync])
    expect((await db.habits.get(h.id))?.createdOn).toBe('2026-11-01')
    expect((await db.habitLogs.get(`${h.id}:2026-11-02`))?.date).toBe('2026-11-02')
  })

  it('el desmarcado de un día también se propaga', async () => {
    const { rowsOf, remote } = fakeServer()
    const h = habit({ dirty: 0 })
    await db.habits.add(h)
    const log = { id: `${h.id}:2026-11-02`, habitId: h.id, date: '2026-11-02', createdAt: h.createdAt, updatedAt: '2026-11-02T08:00:00.000Z', deletedAt: null, dirty: 1 as const }
    await db.habitLogs.add(log)
    await syncOnce(remote, USER, TABLES)
    await db.habitLogs.update(log.id, { deletedAt: '2026-11-02T09:00:00.000Z', updatedAt: '2026-11-02T09:00:00.000Z', dirty: 1 })
    await syncOnce(remote, USER, TABLES)
    expect(rowsOf('habit_logs').get(log.id)?.deleted_at).toBe('2026-11-02T09:00:00.000Z')
  })

  it('si falta una tabla en el servidor, las demás igual se sincronizan', async () => {
    const { rows, remote } = fakeServer()
    const failing: Remote = {
      push: (table, conflict, batch) => (table === 'habits' ? Promise.reject(new Error('Could not find the table public.habits in the schema cache')) : remote.push(table, conflict, batch)),
      pull: (table, since) => remote.pull(table, since),
    }
    const t = task()
    await db.tasks.add(t)
    await db.habits.add(habit())

    await expect(syncOnce(failing, USER, TABLES)).rejects.toThrow(/schema cache/)
    expect(rows.get(t.id)?.title).toBe('Tarea')
    expect((await db.tasks.get(t.id))?.dirty).toBe(0)
    expect((await db.habits.toArray())[0].dirty).toBe(1)
  })
})
