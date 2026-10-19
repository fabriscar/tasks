import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { db } from './core/db'
import { addDays, groupDate, longDate, relativeDate, todayISO } from './core/dates'
import { useSyncState } from './core/syncController'
import type { Task } from './core/types'
import { CaptureBar } from './modules/tasks/components/CaptureBar'
import { CloudIcon } from './modules/tasks/components/icons'
import { SyncPanel } from './modules/tasks/components/SyncPanel'
import { TaskEditor } from './modules/tasks/components/TaskEditor'
import { TaskRow } from './modules/tasks/components/TaskRow'
import type { ParsedTask } from './modules/tasks/parse'
import { addTask, removeTask, restoreTask, setDone, updateTask } from './modules/tasks/repo'
import { buildViews } from './modules/tasks/views'

type Tab = 'hoy' | 'proximas' | 'bandeja' | 'hechas'

interface Toast {
  id: number
  message: string
  undo: () => void
}

function useToday(): string {
  const [today, setToday] = useState(() => todayISO())
  useEffect(() => {
    const tick = () => setToday(todayISO())
    const id = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])
  return today
}

const SYNC_LABEL = {
  unconfigured: 'Sincronización sin configurar',
  'signed-out': 'Sincronización: iniciá sesión',
  idle: 'Sincronizado',
  syncing: 'Sincronizando',
  error: 'Error de sincronización',
} as const

export function App() {
  const today = useToday()
  const all = useLiveQuery(() => db.tasks.toArray(), [])
  const views = useMemo(() => (all ? buildViews(all, today) : null), [all, today])
  const sync = useSyncState()

  const [tab, setTab] = useState<Tab>('hoy')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = useCallback((message: string, undo: () => void) => {
    clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, undo })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }, [])

  const onAdd = async (parsed: ParsedTask) => {
    const task = await addTask(parsed)
    const where = task.dueDate ? `para ${relativeDate(task.dueDate, today).toLowerCase()}` : 'en la bandeja'
    showToast(`Anotada ${where}`, () => void removeTask(task.id))
  }

  const onToggle = (task: Task) => void setDone(task.id, !task.doneAt)
  const onSchedule = (task: Task, offset: number) => void updateTask(task.id, { dueDate: addDays(today, offset) })
  const onDeleted = (task: Task) => showToast('Tarea borrada', () => void restoreTask(task.id))

  const editing = all?.find((t) => t.id === editingId && !t.deletedAt) ?? null
  const rowProps = { today, onToggle, onOpen: (t: Task) => setEditingId(t.id) }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'hoy', label: 'Hoy', count: views?.pendingNow },
    { id: 'proximas', label: 'Próximas' },
    { id: 'bandeja', label: 'Bandeja', count: views?.inbox.length },
    { id: 'hechas', label: 'Hechas' },
  ]

  const title = { hoy: longDate(today), proximas: 'Próximas', bandeja: 'Bandeja', hechas: 'Hechas' }[tab]

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>{title}</h1>
          {tab === 'hoy' && views && (
            <p className="summary">
              {views.pendingNow === 0
                ? 'Nada pendiente'
                : `${views.pendingNow} ${views.pendingNow === 1 ? 'pendiente' : 'pendientes'}`}
              {views.overdue.length > 0 &&
                `, ${views.overdue.length} ${views.overdue.length === 1 ? 'atrasada' : 'atrasadas'}`}
            </p>
          )}
        </div>
        <button
          type="button"
          className={`sync-btn ${sync.status}`}
          aria-label={SYNC_LABEL[sync.status]}
          title={SYNC_LABEL[sync.status]}
          onClick={() => setSyncOpen(true)}
        >
          <CloudIcon />
          <span className="dot" aria-hidden="true" />
        </button>
      </header>

      <nav className="tabs" aria-label="Secciones">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {!!t.count && <span className="count">{t.count}</span>}
          </button>
        ))}
      </nav>

      <main className="page">
        {views && tab === 'hoy' && (
          <>
            {views.overdue.length > 0 && (
              <section className="group">
                <h2 className="group-title late">Atrasadas</h2>
                <ul>
                  {views.overdue.map((t) => (
                    <TaskRow key={t.id} task={t} showDate {...rowProps} />
                  ))}
                </ul>
              </section>
            )}
            <section className="group">
              {views.overdue.length > 0 && <h2 className="group-title">Para hoy</h2>}
              {views.today.length > 0 ? (
                <ul>
                  {views.today.map((t) => (
                    <TaskRow key={t.id} task={t} {...rowProps} />
                  ))}
                </ul>
              ) : (
                views.overdue.length === 0 &&
                views.doneToday.length === 0 && (
                  <p className="note">Nada para hoy. Lo que se te ocurra, anotalo acá abajo antes de que se te pase.</p>
                )
              )}
            </section>
            {views.inbox.length > 0 && (
              <p className="note">
                Tenés {views.inbox.length} {views.inbox.length === 1 ? 'tarea' : 'tareas'} sin fecha.{' '}
                <button type="button" className="link" onClick={() => setTab('bandeja')}>
                  Ver bandeja
                </button>
              </p>
            )}
            {views.doneToday.length > 0 && (
              <section className="group">
                <h2 className="group-title">Hechas hoy</h2>
                <ul>
                  {views.doneToday.map((t) => (
                    <TaskRow key={t.id} task={t} {...rowProps} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {views && tab === 'proximas' &&
          (views.upcoming.length > 0 ? (
            views.upcoming.map((g) => (
              <section className="group" key={g.date}>
                <h2 className="group-title">{groupDate(g.date, today)}</h2>
                <ul>
                  {g.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} {...rowProps} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="note">No hay nada programado. Probá escribir “dentista el jueves” o “pagar expensas el 10”.</p>
          ))}

        {views && tab === 'bandeja' &&
          (views.inbox.length > 0 ? (
            <ul>
              {views.inbox.map((t) => (
                <TaskRow key={t.id} task={t} quickSchedule onSchedule={onSchedule} {...rowProps} />
              ))}
            </ul>
          ) : (
            <p className="note">La bandeja está vacía. Lo que anotes sin fecha aparece acá para que lo ubiques.</p>
          ))}

        {views && tab === 'hechas' &&
          (views.done.length > 0 ? (
            <ul>
              {views.done.map((t) => (
                <TaskRow key={t.id} task={t} {...rowProps} />
              ))}
            </ul>
          ) : (
            <p className="note">Todavía no completaste ninguna tarea.</p>
          ))}
      </main>

      <div className="dock">
        {toast && (
          <div className="toast" role="status" key={toast.id}>
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => {
                toast.undo()
                setToast(null)
              }}
            >
              Deshacer
            </button>
          </div>
        )}
        <CaptureBar onAdd={onAdd} />
      </div>

      {editing && <TaskEditor key={editing.id} task={editing} onClose={() => setEditingId(null)} onDeleted={onDeleted} />}
      {syncOpen && <SyncPanel onClose={() => setSyncOpen(false)} />}
    </div>
  )
}
