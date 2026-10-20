import { toISODate } from '../../core/dates'
import type { Task } from '../../core/types'

export interface DayGroup {
  date: string
  tasks: Task[]
}

export interface Views {
  overdue: Task[]
  today: Task[]
  doneToday: Task[]
  upcoming: DayGroup[]
  inbox: Task[]
  done: Task[]
  /** Pendientes de hoy + atrasadas */
  pendingNow: number
}

const byTimePriority = (a: Task, b: Task) =>
  (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99') ||
  b.priority - a.priority ||
  a.createdAt.localeCompare(b.createdAt)

const byDateThenTime = (a: Task, b: Task) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || byTimePriority(a, b)

export function buildViews(all: Task[], today: string): Views {
  const live = all.filter((t) => !t.deletedAt)
  const open = live.filter((t) => !t.doneAt)

  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort(byDateThenTime)
  const todays = open.filter((t) => t.dueDate === today).sort(byTimePriority)
  const doneToday = live
    .filter((t) => t.doneAt && toISODate(new Date(t.doneAt)) === today)
    .sort((a, b) => a.doneAt!.localeCompare(b.doneAt!))

  const groups = new Map<string, Task[]>()
  for (const t of open.filter((t) => t.dueDate && t.dueDate > today).sort(byDateThenTime)) {
    groups.set(t.dueDate!, [...(groups.get(t.dueDate!) ?? []), t])
  }

  return {
    overdue,
    today: todays,
    doneToday,
    upcoming: [...groups].map(([date, tasks]) => ({ date, tasks })),
    inbox: open.filter((t) => !t.dueDate).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    done: live
      .filter((t) => t.doneAt)
      .sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))
      .slice(0, 100),
    pendingNow: overdue.length + todays.length,
  }
}
