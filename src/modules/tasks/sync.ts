import { db } from '../../core/db'
import { iso, type RemoteRow, type SyncTableDef } from '../../core/sync'
import type { Priority, Repeat, Task } from '../../core/types'

export const tasksSync: SyncTableDef<Task> = {
  remote: 'tasks',
  conflict: 'id',
  // Se conserva el nombre original para no volver a bajar todo en los dispositivos que ya sincronizaban.
  cursorKey: 'lastPull',
  local: () => db.tasks,

  toRemote(t, userId) {
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
  },

  fromRemote(r: RemoteRow): Task {
    const row = r as RemoteRow & {
      title: string
      notes: string | null
      due_date: string | null
      due_time: string | null
      priority: number
      tags: string[] | null
      recurrence: Repeat | null
      done_at: string | null
      created_at: string
      deleted_at: string | null
    }
    return {
      id: row.id,
      title: row.title,
      notes: row.notes ?? '',
      dueDate: row.due_date,
      dueTime: row.due_time ? row.due_time.slice(0, 5) : null,
      priority: row.priority as Priority,
      tags: row.tags ?? [],
      repeat: row.recurrence,
      doneAt: iso(row.done_at),
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
      deletedAt: iso(row.deleted_at),
      dirty: 0,
    }
  },
}
