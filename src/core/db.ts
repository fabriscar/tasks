import Dexie, { type EntityTable } from 'dexie'
import type { Task } from './types'

interface MetaRow {
  key: string
  value: unknown
}

class TareasDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor() {
    super('tareas')
    this.version(1).stores({
      tasks: 'id, dueDate, doneAt, deletedAt, dirty, updatedAt',
      meta: 'key',
    })
  }
}

export const db = new TareasDB()
