import { useState, type FormEvent } from 'react'
import { todayISO, weekdayOf } from '../../../core/dates'
import { repeatLabel } from '../../../core/recurrence'
import type { Priority, Repeat, Task } from '../../../core/types'
import { LIMITS, removeTask, updateTask } from '../repo'
import { Sheet } from './Sheet'

interface TaskEditorProps {
  task: Task
  onClose: () => void
  onDeleted: (task: Task) => void
}

type RepeatKey = 'none' | 'day' | 'week' | 'month' | 'weekdays' | 'custom'

function repeatKey(r: Repeat | null): RepeatKey {
  if (!r) return 'none'
  if (r.interval !== 1) return 'custom'
  if (r.unit === 'day') return 'day'
  if (r.unit === 'month') return 'month'
  return r.weekdays?.length ? 'weekdays' : 'week'
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 0, label: 'Ninguna' },
  { value: 1, label: 'Baja' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Alta' },
]

// Lunes primero, como en el calendario argentino.
const WEEK_BUTTONS = [
  { day: 1, short: 'L', name: 'lunes' },
  { day: 2, short: 'M', name: 'martes' },
  { day: 3, short: 'M', name: 'miércoles' },
  { day: 4, short: 'J', name: 'jueves' },
  { day: 5, short: 'V', name: 'viernes' },
  { day: 6, short: 'S', name: 'sábado' },
  { day: 0, short: 'D', name: 'domingo' },
]

export function TaskEditor({ task, onClose, onDeleted }: TaskEditorProps) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const [dueDate, setDueDate] = useState(task.dueDate ?? '')
  const [dueTime, setDueTime] = useState(task.dueTime ?? '')
  const [priority, setPriority] = useState<Priority>(task.priority)
  const [tags, setTags] = useState(task.tags.map((t) => `#${t}`).join(' '))
  const [repeat, setRepeat] = useState<Repeat | null>(task.repeat)

  const key = repeatKey(repeat)

  const changeRepeat = (next: string) => {
    switch (next) {
      case 'none':
        return setRepeat(null)
      case 'day':
        return setRepeat({ unit: 'day', interval: 1 })
      case 'week':
        return setRepeat({ unit: 'week', interval: 1 })
      case 'month':
        return setRepeat({ unit: 'month', interval: 1 })
      case 'weekdays':
        return setRepeat({ unit: 'week', interval: 1, weekdays: [weekdayOf(dueDate || todayISO())] })
    }
  }

  const toggleWeekday = (day: number) => {
    if (!repeat?.weekdays) return
    const has = repeat.weekdays.includes(day)
    if (has && repeat.weekdays.length === 1) return
    setRepeat({ ...repeat, weekdays: has ? repeat.weekdays.filter((d) => d !== day) : [...repeat.weekdays, day] })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    await updateTask(task.id, {
      title: cleanTitle,
      notes: notes.trim(),
      dueDate: dueDate || (repeat ? todayISO() : null),
      dueTime: dueDate || repeat ? dueTime || null : null,
      priority,
      tags: [...new Set(tags.split(/[\s,]+/).map((t) => t.replace(/^#/, '').toLowerCase()).filter(Boolean))],
      repeat,
    })
    onClose()
  }

  const remove = async () => {
    await removeTask(task.id)
    onDeleted(task)
    onClose()
  }

  return (
    <Sheet title="Editar tarea" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <label>
          Tarea
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} required />
        </label>

        <label>
          Notas
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={LIMITS.notes} />
        </label>

        <div className="form-row">
          <label>
            Fecha
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label>
            Hora
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} disabled={!dueDate && !repeat} />
          </label>
        </div>

        <fieldset>
          <legend>Prioridad</legend>
          <div className="segmented">
            {PRIORITIES.map((p) => (
              <label key={p.value} className={priority === p.value ? 'on' : ''}>
                <input
                  type="radio"
                  name="priority"
                  checked={priority === p.value}
                  onChange={() => setPriority(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          Repetir
          <select value={key} onChange={(e) => changeRepeat(e.target.value)}>
            <option value="none">No repetir</option>
            <option value="day">Todos los días</option>
            <option value="week">Todas las semanas</option>
            <option value="weekdays">Ciertos días de la semana</option>
            <option value="month">Todos los meses</option>
            {key === 'custom' && repeat && <option value="custom">{repeatLabel(repeat)}</option>}
          </select>
        </label>

        {key === 'weekdays' && repeat?.weekdays && (
          <div className="weekdays" role="group" aria-label="Días de la semana">
            {WEEK_BUTTONS.map((w) => (
              <button
                key={w.day}
                type="button"
                className={repeat.weekdays!.includes(w.day) ? 'on' : ''}
                aria-pressed={repeat.weekdays!.includes(w.day)}
                aria-label={w.name}
                onClick={() => toggleWeekday(w.day)}
              >
                {w.short}
              </button>
            ))}
          </div>
        )}

        <label>
          Etiquetas
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#casa #trabajo" maxLength={400} />
        </label>

        <div className="form-actions">
          <button type="button" className="btn danger" onClick={remove}>
            Borrar
          </button>
          <button type="submit" className="btn primary">
            Guardar
          </button>
        </div>
      </form>
    </Sheet>
  )
}
