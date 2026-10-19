import { db } from './db'
import type { Priority, Repeat, Task } from './types'

/** Fila tal como vive en Supabase (snake_case). */
export interface RemoteTask {
  id: string
  user_id: string
  title: string
  notes: string
  due_date: string | null
  due_time: string | null
  priority: number
  tags: string[]
  recurrence: Repeat | null
  done_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  synced_at?: string
}

export interface Remote {
  push(rows: RemoteTask[]): Promise<void>
  /** Todas las filas con synced_at posterior a `since`, ordenadas por synced_at. */
  pull(since: string | null): Promise<RemoteTask[]>
}

const OVERLAP_MS = 5_000
const BATCH = 200

/** Postgres devuelve microsegundos; Date.parse solo es confiable con milisegundos. */
export const ts = (s: string) => Date.parse(s.replace(/(\.\d{3})\d+/, '$1'))
const iso = (s: string | null) => (s ? new Date(ts(s)).toISOString() : null)

export function toRemote(t: Task, userId: string): RemoteTask {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    notes: t.notes,
    due_date: t.dueDate,
    due_time: t.dueTime,
    priority: t.priority,
    tags: t.tags,
    recurrence: t.repeat,
    done_at: t.doneAt,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    deleted_at: t.deletedAt,
  }
}

export function fromRemote(r: RemoteTask): Task {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? '',
    dueDate: r.due_date,
    dueTime: r.due_time ? r.due_time.slice(0, 5) : null,
    priority: r.priority as Priority,
    tags: r.tags ?? [],
    repeat: r.recurrence,
    doneAt: iso(r.done_at),
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    deletedAt: iso(r.deleted_at),
    dirty: 0,
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Una pasada de sincronización: sube lo pendiente y baja lo nuevo.
 * Ante un conflicto gana la edición más reciente (por updatedAt) de cada tarea.
 */
export async function syncOnce(remote: Remote, userId: string): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0

  const dirty = await db.tasks.where('dirty').equals(1).toArray()
  for (const batch of chunk(dirty, BATCH)) {
    await remote.push(batch.map((t) => toRemote(t, userId)))
    // Si la tarea se volvió a editar mientras subía, queda pendiente para la próxima pasada.
    await db.transaction('rw', db.tasks, async () => {
      for (const t of batch) {
        const current = await db.tasks.get(t.id)
        if (current && current.updatedAt === t.updatedAt) await db.tasks.update(t.id, { dirty: 0 })
      }
    })
    pushed += batch.length
  }

  const cursor = (await db.meta.get('lastPull'))?.value as string | undefined
  const since = cursor ? new Date(ts(cursor) - OVERLAP_MS).toISOString() : null
  const rows = await remote.pull(since)

  await db.transaction('rw', db.tasks, db.meta, async () => {
    let newest = cursor ? ts(cursor) : -Infinity
    let newestRaw = cursor
    for (const r of rows) {
      const local = await db.tasks.get(r.id)
      if (!(local?.dirty && ts(local.updatedAt) > ts(r.updated_at))) {
        await db.tasks.put(fromRemote(r))
      }
      if (r.synced_at && ts(r.synced_at) > newest) {
        newest = ts(r.synced_at)
        newestRaw = r.synced_at
      }
    }
    if (newestRaw && newestRaw !== cursor) await db.meta.put({ key: 'lastPull', value: newestRaw })
  })

  return { pushed, pulled: rows.length }
}
