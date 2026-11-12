import { db } from '../../core/db'
import { toISODate, todayISO } from '../../core/dates'
import { emitLocalChange } from '../../core/events'
import type { DayNote, Habit, HabitLog } from '../../core/types'

const nowISO = () => new Date().toISOString()

/** Topes alineados con las restricciones de supabase/schema.sql. */
export const HABIT_LIMITS = { name: 60, note: 500, habits: 30 }

/** Hábitos que trae el cuaderno de papel, para arrancar sin tipear. */
export const STARTER_HABITS = ['Leer', 'Gimnasio', 'Dejar vicios', 'Estudiar', 'Dormir 8 horas', 'Celular <3hs', 'Escribir']

export const logId = (habitId: string, date: string) => `${habitId}:${date}`

/** Los hábitos que se ven hoy, en orden de izquierda a derecha. */
export function activeHabits(all: Habit[]): Habit[] {
  return all.filter((h) => !h.deletedAt && !h.archivedOn).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

export async function addHabit(name: string): Promise<Habit | null> {
  const clean = name.trim().slice(0, HABIT_LIMITS.name)
  if (!clean) return null
  const current = activeHabits(await db.habits.toArray())
  if (current.length >= HABIT_LIMITS.habits) return null
  const now = nowISO()
  const today = new Date()
  const habit: Habit = {
    id: crypto.randomUUID(),
    name: clean,
    position: current.length ? current[current.length - 1].position + 1 : 0,
    // Aparece desde el primer día de este mes, así se pueden completar los días que ya pasaron.
    createdOn: toISODate(new Date(today.getFullYear(), today.getMonth(), 1)),
    archivedOn: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: 1,
  }
  await db.habits.add(habit)
  emitLocalChange()
  return habit
}

export async function addStarterHabits(): Promise<void> {
  const now = nowISO()
  const monthStart = toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  await db.transaction('rw', db.habits, async () => {
    const start = activeHabits(await db.habits.toArray()).length
    const room = HABIT_LIMITS.habits - start
    const rows: Habit[] = STARTER_HABITS.slice(0, Math.max(0, room)).map((name, i) => ({
      id: crypto.randomUUID(),
      name,
      position: start + i,
      createdOn: monthStart,
      archivedOn: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      dirty: 1,
    }))
    await db.habits.bulkAdd(rows)
  })
  emitLocalChange()
}

export async function renameHabit(id: string, name: string): Promise<void> {
  const clean = name.trim().slice(0, HABIT_LIMITS.name)
  if (!clean) return
  await db.habits.update(id, { name: clean, updatedAt: nowISO(), dirty: 1 })
  emitLocalChange()
}

/** Mueve un hábito una posición a la izquierda (-1) o a la derecha (1). */
export async function moveHabit(id: string, direction: -1 | 1): Promise<void> {
  const list = activeHabits(await db.habits.toArray())
  const from = list.findIndex((h) => h.id === id)
  const to = from + direction
  if (from < 0 || to < 0 || to >= list.length) return
  ;[list[from], list[to]] = [list[to], list[from]]
  const now = nowISO()
  await db.transaction('rw', db.habits, async () => {
    for (const [index, habit] of list.entries()) {
      if (habit.position !== index) await db.habits.update(habit.id, { position: index, updatedAt: now, dirty: 1 })
    }
  })
  emitLocalChange()
}

/** Quita el hábito desde el mes que viene. El historial de los meses anteriores y de este se conserva. */
export async function archiveHabit(id: string): Promise<void> {
  await db.habits.update(id, { archivedOn: todayISO(), updatedAt: nowISO(), dirty: 1 })
  emitLocalChange()
}

export async function restoreHabit(id: string): Promise<void> {
  const position = activeHabits(await db.habits.toArray()).length
  await db.habits.update(id, { archivedOn: null, position, updatedAt: nowISO(), dirty: 1 })
  emitLocalChange()
}

/** Borra el hábito y todo su historial. */
export async function deleteHabit(id: string): Promise<void> {
  const now = nowISO()
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habits.update(id, { deletedAt: now, updatedAt: now, dirty: 1 })
    const logs = await db.habitLogs.where('habitId').equals(id).filter((l) => !l.deletedAt).toArray()
    for (const log of logs) await db.habitLogs.update(log.id, { deletedAt: now, updatedAt: now, dirty: 1 })
  })
  emitLocalChange()
}

/** Marca o desmarca un hábito en un día. No se pueden marcar días futuros. */
export async function setHabitDone(habitId: string, date: string, done: boolean): Promise<void> {
  if (date > todayISO()) return
  const id = logId(habitId, date)
  const now = nowISO()
  await db.transaction('rw', db.habitLogs, async () => {
    const existing: HabitLog | undefined = await db.habitLogs.get(id)
    if (done) {
      if (!existing) await db.habitLogs.add({ id, habitId, date, createdAt: now, updatedAt: now, deletedAt: null, dirty: 1 })
      else if (existing.deletedAt) await db.habitLogs.update(id, { deletedAt: null, updatedAt: now, dirty: 1 })
    } else if (existing && !existing.deletedAt) {
      await db.habitLogs.update(id, { deletedAt: now, updatedAt: now, dirty: 1 })
    }
  })
  emitLocalChange()
}

/** Guarda el hecho relevante del día. Un texto vacío lo borra. */
export async function setDayNote(date: string, text: string): Promise<void> {
  const clean = text.trim().slice(0, HABIT_LIMITS.note)
  const now = nowISO()
  await db.transaction('rw', db.dayNotes, async () => {
    const existing: DayNote | undefined = await db.dayNotes.get(date)
    if (!clean) {
      if (existing && !existing.deletedAt) await db.dayNotes.update(date, { deletedAt: now, updatedAt: now, dirty: 1 })
    } else if (existing) {
      await db.dayNotes.update(date, { text: clean, deletedAt: null, updatedAt: now, dirty: 1 })
    } else {
      await db.dayNotes.add({ id: date, text: clean, createdAt: now, updatedAt: now, deletedAt: null, dirty: 1 })
    }
  })
  emitLocalChange()
}
