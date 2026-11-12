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

/** Hábito que se marca día a día (leer, gimnasio, dormir 8 horas…). */
export interface Habit {
  id: string
  name: string
  /** Orden en la tabla, de izquierda a derecha. */
  position: number
  /** YYYY-MM-DD: primer día del mes en que se creó. Antes de ese mes no aparece. */
  createdOn: string
  /** YYYY-MM-DD en que se quitó. Desde el mes siguiente deja de aparecer; el historial se conserva. */
  archivedOn: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  dirty: 0 | 1
}

/** Un hábito cumplido un día. Existe = cumplido; al desmarcar se borra de forma lógica. */
export interface HabitLog {
  /** `${habitId}:${date}` */
  id: string
  habitId: string
  /** YYYY-MM-DD */
  date: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  dirty: 0 | 1
}

/** El "hecho relevante" de un día. */
export interface DayNote {
  /** YYYY-MM-DD */
  id: string
  text: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  dirty: 0 | 1
}
