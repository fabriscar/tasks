import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../core/db'
import { activeHabits, setHabitDone } from '../repo'

interface TodayHabitsProps {
  today: string
  onOpenDay: (date: string) => void
}

/** Los hábitos del día en la pestaña "Hoy": un toque para marcar, y una línea para lo más relevante. */
export function TodayHabits({ today, onOpenDay }: TodayHabitsProps) {
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.where('date').equals(today).toArray(), [today])
  const note = useLiveQuery(() => db.dayNotes.get(today), [today])

  if (!habits || !logs) return null
  const list = activeHabits(habits)
  if (list.length === 0) return null

  const done = new Set(logs.filter((l) => !l.deletedAt).map((l) => l.habitId))
  const count = list.filter((h) => done.has(h.id)).length
  const text = note && !note.deletedAt ? note.text : ''

  return (
    <section className="group">
      <h2 className="group-title">
        Hábitos de hoy <span className="tally">{count}/{list.length}</span>
      </h2>
      <ul>
        {list.map((habit) => {
          const isDone = done.has(habit.id)
          return (
            <li key={habit.id} className={`row${isDone ? ' is-done' : ''}`}>
              <button
                type="button"
                className="check"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`${habit.name}: ${isDone ? 'hecho' : 'sin hacer'}`}
                onClick={() => void setHabitDone(habit.id, today, !isDone)}
              >
                <svg viewBox="0 0 28 28" aria-hidden="true">
                  <circle className="check-ring" cx="14" cy="14" r="9.5" />
                  <path className="check-tick" d="M8.5 14.5l4 4 7.5-9" />
                </svg>
              </button>
              <div className="row-body">
                <button type="button" className="row-title" onClick={() => void setHabitDone(habit.id, today, !isDone)}>
                  <span className="text">{habit.name}</span>
                </button>
              </div>
            </li>
          )
        })}
        <li className="row">
          <span className="gutter-mark" aria-hidden="true">✎</span>
          <div className="row-body">
            <button type="button" className="row-title" onClick={() => onOpenDay(today)}>
              {text ? <span className="text">{text}</span> : <span className="placeholder">Anotá lo más relevante de hoy</span>}
            </button>
          </div>
        </li>
      </ul>
    </section>
  )
}
