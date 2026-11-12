import Dexie, { type Table } from 'dexie'
import type { DayNote, Habit, HabitLog, Task } from './types'

interface MetaRow {
  key: string
  value: unknown
}

class TareasDB extends Dexie {
  tasks!: Table<Task, string>
  habits!: Table<Habit, string>
  habitLogs!: Table<HabitLog, string>
  dayNotes!: Table<DayNote, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('tareas')
    this.version(1).stores({
      tasks: 'id, dueDate, doneAt, deletedAt, dirty, updatedAt',
      meta: 'key',
    })
    this.version(2).stores({
      tasks: 'id, dueDate, doneAt, deletedAt, dirty, updatedAt',
      meta: 'key',
      habits: 'id, position, deletedAt, dirty',
      habitLogs: 'id, habitId, date, deletedAt, dirty',
      dayNotes: 'id, deletedAt, dirty',
    })
  }
}

export const db = new TareasDB()
