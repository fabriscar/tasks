export interface Repeat {
  unit: 'day' | 'week' | 'month'
  interval: number
  /** 0 = domingo … 6 = sábado. Solo aplica a unit 'week'. */
  weekdays?: number[]
}

export type Priority = 0 | 1 | 2 | 3

export interface Task {
  id: string
  title: string
  notes: string
  /** YYYY-MM-DD en hora local */
  dueDate: string | null
  /** HH:mm en hora local */
  dueTime: string | null
  priority: Priority
  tags: string[]
  repeat: Repeat | null
  /** ISO UTC */
  doneAt: string | null
  createdAt: string
  updatedAt: string
  /** Borrado lógico: necesario para propagar borrados entre dispositivos */
  deletedAt: string | null
  /** 1 = cambios locales sin subir. Solo local, no se sincroniza. */
  dirty: 0 | 1
}
