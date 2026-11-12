import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { db } from '../../../core/db'
import {
  HABIT_LIMITS,
  activeHabits,
  addHabit,
  addStarterHabits,
  archiveHabit,
  deleteHabit,
  moveHabit,
  renameHabit,
  restoreHabit,
} from '../repo'
import { Sheet } from '../../tasks/components/Sheet'

interface HabitManagerProps {
  onClose: () => void
}

export function HabitManager({ onClose }: HabitManagerProps) {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const [newName, setNewName] = useState('')

  if (!habits) return null
  const active = activeHabits(habits)
  const removed = habits.filter((h) => !h.deletedAt && h.archivedOn)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (await addHabit(newName)) setNewName('')
  }

  const remove = (id: string, name: string) => {
    if (window.confirm(`"${name}" deja de aparecer desde el mes que viene. Se conserva todo su historial. ¿Quitarlo?`)) {
      void archiveHabit(id)
    }
  }

  const erase = (id: string, name: string) => {
    if (window.confirm(`Se borra "${name}" y todos sus días marcados. No se puede deshacer. ¿Borrarlo?`)) {
      void deleteHabit(id)
    }
  }

  return (
    <Sheet title="Mis hábitos" onClose={onClose}>
      <div className="form">
        {active.length === 0 && (
          <div className="form">
            <p className="status">Todavía no tenés hábitos. Podés arrancar con los de tu cuaderno o armar los tuyos.</p>
            <button type="button" className="btn" onClick={() => void addStarterHabits()}>
              Cargar los de mi cuaderno (Leer, Gimnasio, Dejar vicios…)
            </button>
          </div>
        )}

        <ul className="manage-list">
          {active.map((habit, index) => (
            <li key={habit.id}>
              <input
                aria-label={`Nombre del hábito ${habit.name}`}
                defaultValue={habit.name}
                maxLength={HABIT_LIMITS.name}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value.trim() !== habit.name) void renameHabit(habit.id, e.target.value)
                  else e.target.value = habit.name
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              <div className="manage-actions">
                <button type="button" className="mini" aria-label={`Mover ${habit.name} a la izquierda`} disabled={index === 0} onClick={() => void moveHabit(habit.id, -1)}>
                  ◀
                </button>
                <button type="button" className="mini" aria-label={`Mover ${habit.name} a la derecha`} disabled={index === active.length - 1} onClick={() => void moveHabit(habit.id, 1)}>
                  ▶
                </button>
                <button type="button" className="mini text" onClick={() => remove(habit.id, habit.name)}>
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>

        <form className="add-habit" onSubmit={add}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={HABIT_LIMITS.name}
            placeholder="Nuevo hábito, ej: Meditar"
            aria-label="Nuevo hábito"
            enterKeyHint="done"
          />
          <button type="submit" className="btn primary" disabled={!newName.trim() || active.length >= HABIT_LIMITS.habits}>
            Agregar
          </button>
        </form>

        {removed.length > 0 && (
          <details className="security">
            <summary>Hábitos quitados ({removed.length})</summary>
            <ul className="manage-list">
              {removed.map((habit) => (
                <li key={habit.id}>
                  <span className="removed-name">{habit.name}</span>
                  <div className="manage-actions">
                    <button type="button" className="mini text" onClick={() => void restoreHabit(habit.id)}>
                      Volver a usar
                    </button>
                    <button type="button" className="mini text danger" onClick={() => erase(habit.id, habit.name)}>
                      Borrar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}

        <button type="button" className="btn" onClick={onClose}>
          Listo
        </button>
      </div>
    </Sheet>
  )
}
