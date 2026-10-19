import { db } from '../../core/db'
import { todayISO } from '../../core/dates'
import { emitLocalChange } from '../../core/events'
import { nextOccurrence } from '../../core/recurrence'
import type { Task } from '../../core/types'

const nowISO = () => new Date().toISOString()

export type TaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'dirty'>> & { title: string }

export async function addTask(input: TaskInput): Promise<Task> {
  const now = nowISO()
  const task: Task = {
    notes: '',
    dueDate: null,
    dueTime: null,
    priority: 0,
    tags: [],
    repeat: null,
    doneAt: null,
    ...input,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
  }
  await db.tasks.add(task)
  emitLocalChange()
  return task
}

export async function updateTask(id: string, patch: Partial<Omit<Task, 'id'>>): Promise<void> {
  await db.tasks.update(id, { ...patch, updatedAt: nowISO(), dirty: 1 })
  emitLocalChange()
}

/** Marca o desmarca como hecha. Una tarea repetitiva crea su próxima ocurrencia al completarse. */
export async function setDone(id: string, done: boolean): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const task = await db.tasks.get(id)
    if (!task) return
    const now = nowISO()
    if (!done) {
      await db.tasks.update(id, { doneAt: null, updatedAt: now, dirty: 1 })
      return
    }
    if (task.doneAt) return
    await db.tasks.update(id, { doneAt: now, updatedAt: now, dirty: 1 })
    if (task.repeat) {
      const today = todayISO()
      await db.tasks.add({
        ...task,
        id: crypto.randomUUID(),
        dueDate: nextOccurrence(task.repeat, task.dueDate ?? today, today),
        doneAt: null,
        createdAt: now,
        updatedAt: now,
        dirty: 1,
      })
    }
  })
  emitLocalChange()
}

export async function removeTask(id: string): Promise<void> {
  const now = nowISO()
  await db.tasks.update(id, { deletedAt: now, updatedAt: now, dirty: 1 })
  emitLocalChange()
}

export async function restoreTask(id: string): Promise<void> {
  await db.tasks.update(id, { deletedAt: null, updatedAt: nowISO(), dirty: 1 })
  emitLocalChange()
}
