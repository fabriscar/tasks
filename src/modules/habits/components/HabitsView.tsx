import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../../core/db'
import { longDate } from '../../../core/dates'
import type { DayNote } from '../../../core/types'
import { ChevronLeftIcon, ChevronRightIcon } from '../../tasks/components/icons'
import { addStarterHabits } from '../repo'
import { buildMonth, monthKey, monthLabel, monthRefOf, shiftMonth, daysOfMonth } from '../stats'
import { HabitGrid } from './HabitGrid'

interface HabitsViewProps {
  today: string
  onOpenDay: (date: string) => void
  onManage: () => void
}

export function HabitsView({ today, onOpenDay, onManage }: HabitsViewProps) {
  const thisMonth = monthRefOf(today)
  const [ref, setRef] = useState(thisMonth)
  const isCurrent = monthKey(ref) === monthKey(thisMonth)

  const days = useMemo(() => daysOfMonth(ref), [ref])
  const first = days[0]
  const last = days[days.length - 1]

  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.where('date').between(first, last, true, true).toArray(), [first, last])
  const noteRows = useLiveQuery(() => db.dayNotes.where('id').between(first, last, true, true).toArray(), [first, last])

  const month = useMemo(() => (habits && logs ? buildMonth(ref, habits, logs, today) : null), [habits, logs, ref, today])
  const notes = useMemo(() => new Map<string, DayNote>((noteRows ?? []).filter((n) => !n.deletedAt).map((n) => [n.id, n])), [noteRows])

  if (!month) return null
  const counted = days.filter((d) => d <= today)

  return (
    <>
      <div className="month-nav">
        <button type="button" className="icon-btn" aria-label="Mes anterior" onClick={() => setRef(shiftMonth(ref, -1))}>
          <ChevronLeftIcon />
        </button>
        <h2>{monthLabel(ref)}</h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Mes siguiente"
          disabled={isCurrent}
          onClick={() => setRef(shiftMonth(ref, 1))}
        >
          <ChevronRightIcon />
        </button>
        <span className="month-actions">
          {!isCurrent && (
            <button type="button" className="link" onClick={() => setRef(thisMonth)}>
              Ir a hoy
            </button>
          )}
          <button type="button" className="btn small" onClick={onManage}>
            Mis hábitos
          </button>
        </span>
      </div>

      {month.columns.length === 0 ? (
        <div className="habits-empty">
          <p>{isCurrent ? 'Todavía no armaste tus hábitos.' : 'No hay hábitos en este mes.'}</p>
          {isCurrent && (
            <div className="empty-actions">
              <button type="button" className="btn primary" onClick={() => void addStarterHabits()}>
                Usar los de mi cuaderno
              </button>
              <button type="button" className="btn" onClick={onManage}>
                Armar los míos
              </button>
            </div>
          )}
        </div>
      ) : (
        <HabitGrid month={month} today={today} notes={notes} onOpenDay={onOpenDay} />
      )}

      <section className="facts" aria-label="Hechos relevantes del mes">
        <h2 className="facts-title">Hechos relevantes</h2>
        <div className="ruled">
          {counted.length === 0 ? (
            <p className="note">Este mes todavía no empezó.</p>
          ) : (
            <ul>
              {counted.map((day) => {
                const note = notes.get(day)
                return (
                  <li key={day} className="row">
                    <span className="day-number">{Number(day.slice(8, 10))}</span>
                    <div className="row-body">
                      <button type="button" className="row-title" onClick={() => onOpenDay(day)} aria-label={`${longDate(day)}: ${note ? note.text : 'sin nota'}`}>
                        {note ? <span className="text">{note.text}</span> : <span className="placeholder">—</span>}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}
