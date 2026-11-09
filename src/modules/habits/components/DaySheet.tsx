import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../../core/db'
import { longDate, todayISO } from '../../../core/dates'
import { HABIT_LIMITS, setDayNote, setHabitDone } from '../repo'
import { buildMonth, monthRefOf } from '../stats'
import { Sheet } from '../../tasks/components/Sheet'

interface DaySheetProps {
  date: string
  onClose: () => void
}

/** Un día: qué hábitos se cumplieron y qué fue lo relevante. Sirve también para completar días pasados. */
export function DaySheet({ date, onClose }: DaySheetProps) {
  const ref = monthRefOf(date)
  const habits = useLiveQuery(() => db.habits.toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.where('date').equals(date).toArray(), [date])
  const saved = useLiveQuery(() => db.dayNotes.get(date), [date])
  const [text, setText] = useState<string | null>(null)

  const savedText = saved && !saved.deletedAt ? saved.text : ''
  const draft = text ?? savedText

  const month = habits && logs ? buildMonth(ref, habits, logs, todayISO()) : null
  const dayIndex = Number(date.slice(8, 10)) - 1

  const close = () => {
    if (text !== null && text.trim() !== savedText.trim()) void setDayNote(date, text)
    onClose()
  }

  return (
    <Sheet title={longDate(date)} onClose={close}>
      <div className="form">
        {month && month.columns.length > 0 && (
          <div className="toggle-list" role="group" aria-label="Hábitos del día">
            {month.columns.map((c) => {
              const state = c.cells[dayIndex]
              const isDone = state === 'done'
              const disabled = state === 'off' || state === 'future'
              return (
                <button
                  key={c.habit.id}
                  type="button"
                  className={`toggle-row${isDone ? ' is-done' : ''}`}
                  role="checkbox"
                  aria-checked={isDone}
                  disabled={disabled}
                  onClick={() => void setHabitDone(c.habit.id, date, !isDone)}
                >
                  <svg viewBox="0 0 28 28" aria-hidden="true">
                    <circle className="check-ring" cx="14" cy="14" r="9.5" />
                    <path className="check-tick" d="M8.5 14.5l4 4 7.5-9" />
                  </svg>
                  <span>{c.habit.name}</span>
                </button>
              )
            })}
          </div>
        )}

        <label>
          Hecho relevante del día
          <textarea
            value={draft}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={HABIT_LIMITS.note}
            placeholder="Algo que valga la pena recordar de este día"
          />
        </label>

        <button type="button" className="btn primary" onClick={close}>
          Listo
        </button>
      </div>
    </Sheet>
  )
}
