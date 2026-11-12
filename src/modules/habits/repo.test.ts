import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../core/db'
import { todayISO } from '../../core/dates'
import {
  activeHabits,
  addHabit,
  addStarterHabits,
  archiveHabit,
  deleteHabit,
  moveHabit,
  restoreHabit,
  setDayNote,
  setHabitDone,
} from './repo'

beforeEach(async () => {
  for (const table of db.tables) await table.clear()
})

const names = async () => activeHabits(await db.habits.toArray()).map((h) => h.name)

describe('hábitos', () => {
  it('agrega hábitos en orden y con el nombre recortado', async () => {
    await addHabit('  Leer ')
    await addHabit('Gimnasio')
    expect(await names()).toEqual(['Leer', 'Gimnasio'])
    expect(await addHabit('   ')).toBeNull()
  })

  it('carga los hábitos de arranque del cuaderno', async () => {
    await addStarterHabits()
    expect(await names()).toEqual(['Leer', 'Gimnasio', 'Dejar vicios', 'Estudiar', 'Dormir 8 horas', 'Celular <3hs', 'Escribir'])
  })

  it('no permite más de 30 hábitos', async () => {
    for (let i = 0; i < 30; i++) await addHabit(`H${i}`)
    expect(await addHabit('uno de más')).toBeNull()
    expect(await db.habits.count()).toBe(30)
  })

  it('reordena intercambiando posiciones', async () => {
    const a = (await addHabit('A'))!
    await addHabit('B')
    const c = (await addHabit('C'))!
    await moveHabit(c.id, -1)
    expect(await names()).toEqual(['A', 'C', 'B'])
    await moveHabit(a.id, -1) // ya está primero: no cambia nada
    expect(await names()).toEqual(['A', 'C', 'B'])
  })

  it('quitar conserva el historial y se puede volver a activar', async () => {
    const h = (await addHabit('Leer'))!
    await setHabitDone(h.id, todayISO(), true)
    await archiveHabit(h.id)
    expect(await names()).toEqual([])
    expect((await db.habitLogs.toArray()).filter((l) => !l.deletedAt)).toHaveLength(1)
    await restoreHabit(h.id)
    expect(await names()).toEqual(['Leer'])
  })

  it('borrar elimina el hábito y todo su historial', async () => {
    const h = (await addHabit('Leer'))!
    await setHabitDone(h.id, todayISO(), true)
    await deleteHabit(h.id)
    expect(await names()).toEqual([])
    expect((await db.habitLogs.toArray()).every((l) => l.deletedAt)).toBe(true)
    expect((await db.habits.get(h.id))?.dirty).toBe(1)
  })
})

describe('marcar días', () => {
  it('marca, desmarca y vuelve a marcar sin duplicar filas', async () => {
    const h = (await addHabit('Leer'))!
    const today = todayISO()
    await setHabitDone(h.id, today, true)
    await setHabitDone(h.id, today, false)
    expect((await db.habitLogs.get(`${h.id}:${today}`))?.deletedAt).not.toBeNull()
    await setHabitDone(h.id, today, true)
    expect(await db.habitLogs.count()).toBe(1)
    expect((await db.habitLogs.get(`${h.id}:${today}`))?.deletedAt).toBeNull()
  })

  it('no deja marcar días que todavía no llegaron', async () => {
    const h = (await addHabit('Leer'))!
    await setHabitDone(h.id, '2999-01-01', true)
    expect(await db.habitLogs.count()).toBe(0)
  })
})

describe('hecho relevante del día', () => {
  it('guarda, edita y borra al vaciar el texto', async () => {
    await setDayNote('2026-11-09', '  Cobré mi sueldo ')
    expect((await db.dayNotes.get('2026-11-09'))?.text).toBe('Cobré mi sueldo')
    await setDayNote('2026-11-09', 'Cobré y cociné pastas')
    expect(await db.dayNotes.count()).toBe(1)
    await setDayNote('2026-11-09', '   ')
    expect((await db.dayNotes.get('2026-11-09'))?.deletedAt).not.toBeNull()
  })

  it('recorta a 500 caracteres', async () => {
    await setDayNote('2026-11-09', 'x'.repeat(900))
    expect((await db.dayNotes.get('2026-11-09'))?.text).toHaveLength(500)
  })
})
