import { relativeDate } from '../../../core/dates'
import { repeatLabel } from '../../../core/recurrence'
import type { Task } from '../../../core/types'
import { RepeatIcon } from './icons'

interface TaskRowProps {
  task: Task
  today: string
  /** Muestra la fecha de vencimiento junto al título (útil fuera de "Hoy"). */
  showDate?: boolean
  /** Muestra los atajos "Hoy" y "Mañana" (para la bandeja). */
  quickSchedule?: boolean
  onToggle: (task: Task) => void
  onOpen: (task: Task) => void
  onSchedule?: (task: Task, offsetDays: number) => void
}

export function TaskRow({ task, today, showDate, quickSchedule, onToggle, onOpen, onSchedule }: TaskRowProps) {
  const done = !!task.doneAt
  const late = !done && !!task.dueDate && task.dueDate < today

  return (
    <li className={`row${done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="check"
        role="checkbox"
        aria-checked={done}
        aria-label={`${done ? 'Desmarcar' : 'Marcar como hecha'}: ${task.title}`}
        onClick={() => onToggle(task)}
      >
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <circle className="check-ring" cx="14" cy="14" r="9.5" />
          <path className="check-tick" d="M8.5 14.5l4 4 7.5-9" />
        </svg>
      </button>

      <div className="row-body">
        <button type="button" className="row-title" onClick={() => onOpen(task)}>
          <span className={`text${task.priority === 3 ? ' hl' : ''}`}>{task.title}</span>
          {task.priority === 2 && <span className="meta mark" aria-label="Prioridad media">!</span>}
          {task.dueTime && <span className="meta">{task.dueTime}</span>}
          {showDate && task.dueDate && (
            <span className={`meta${late ? ' late' : ''}`}>{relativeDate(task.dueDate, today)}</span>
          )}
          {task.repeat && (
            <span className="meta" title={repeatLabel(task.repeat)}>
              <RepeatIcon />
              <span className="sr-only">{repeatLabel(task.repeat)}</span>
            </span>
          )}
          {task.tags.map((tag) => (
            <span key={tag} className="meta tag">
              #{tag}
            </span>
          ))}
        </button>

        {quickSchedule && onSchedule && !done && (
          <div className="quick">
            <button type="button" onClick={() => onSchedule(task, 0)}>
              Hoy
            </button>
            <button type="button" onClick={() => onSchedule(task, 1)}>
              Mañana
            </button>
          </div>
        )}
      </div>
    </li>
  )
}
