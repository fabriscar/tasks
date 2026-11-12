import { db } from '../../core/db'
import { iso, type RemoteRow, type SyncTableDef } from '../../core/sync'
import type { DayNote, Habit, HabitLog } from '../../core/types'

type Row<T> = RemoteRow & T

export const habitsSync: SyncTableDef<Habit> = {
  remote: 'habits',
  conflict: 'user_id,id',
  cursorKey: 'lastPull:habits',
  local: () => db.habits,

  toRemote(h, userId) {
    return {
      id: h.id,
      user_id: userId,
      name: h.name,
      position: h.position,
      created_on: h.createdOn,
      archived_on: h.archivedOn,
      created_at: h.createdAt,
      updated_at: h.updatedAt,
      deleted_at: h.deletedAt,
    }
  },

  fromRemote(r) {
    const row = r as Row<{
      name: string
      position: number
      created_on: string
      archived_on: string | null
      created_at: string
      deleted_at: string | null
    }>
    return {
      id: row.id,
      name: row.name,
      position: row.position,
      createdOn: row.created_on,
      archivedOn: row.archived_on,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
      deletedAt: iso(row.deleted_at),
      dirty: 0,
    }
  },
}

export const habitLogsSync: SyncTableDef<HabitLog> = {
  remote: 'habit_logs',
  conflict: 'user_id,id',
  cursorKey: 'lastPull:habit_logs',
  local: () => db.habitLogs,

  toRemote(l, userId) {
    return {
      id: l.id,
      user_id: userId,
      habit_id: l.habitId,
      date: l.date,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
      deleted_at: l.deletedAt,
    }
  },

  fromRemote(r) {
    const row = r as Row<{ habit_id: string; date: string; created_at: string; deleted_at: string | null }>
    return {
      id: row.id,
      habitId: row.habit_id,
      date: row.date,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
      deletedAt: iso(row.deleted_at),
      dirty: 0,
    }
  },
}

export const dayNotesSync: SyncTableDef<DayNote> = {
  remote: 'day_notes',
  conflict: 'user_id,id',
  cursorKey: 'lastPull:day_notes',
  local: () => db.dayNotes,

  toRemote(n, userId) {
    return {
      id: n.id,
      user_id: userId,
      text: n.text,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
      deleted_at: n.deletedAt,
    }
  },

  fromRemote(r) {
    const row = r as Row<{ text: string; created_at: string; deleted_at: string | null }>
    return {
      id: row.id,
      text: row.text,
      createdAt: iso(row.created_at)!,
      updatedAt: iso(row.updated_at)!,
      deletedAt: iso(row.deleted_at),
      dirty: 0,
    }
  },
}
