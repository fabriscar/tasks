import { useState, type FormEvent } from 'react'
import { db } from '../../../core/db'
import { todayISO } from '../../../core/dates'
import { signIn, signOut, signUp, syncNow, useSyncState } from '../../../core/syncController'
import { Sheet } from './Sheet'

interface SyncPanelProps {
  onClose: () => void
}

const STATUS_TEXT = {
  unconfigured: 'Sin sincronización: los datos viven solo en este dispositivo.',
  'signed-out': 'Iniciá sesión para ver tus tareas en todos tus dispositivos.',
  idle: 'Sincronizado.',
  syncing: 'Sincronizando…',
  error: 'No se pudo sincronizar.',
} as const

async function exportBackup() {
  const tasks = (await db.tasks.toArray()).map(({ dirty: _dirty, ...task }) => task)
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), tasks }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tareas-${todayISO()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function SyncPanel({ onClose }: SyncPanelProps) {
  const sync = useSyncState()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const login = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setMessage(await signIn(email.trim(), password))
    setBusy(false)
  }

  const register = async () => {
    if (!email.trim() || password.length < 6) {
      setMessage('Completá el email y una contraseña de al menos 6 caracteres.')
      return
    }
    setBusy(true)
    const result = await signUp(email.trim(), password)
    setMessage(
      result.error ??
        (result.needsConfirmation ? 'Cuenta creada. Confirmá tu email y después iniciá sesión.' : null),
    )
    setBusy(false)
  }

  return (
    <Sheet title="Sincronización" onClose={onClose}>
      <div className="form">
        <p className="status" role="status">
          {STATUS_TEXT[sync.status]}
          {sync.status === 'error' && sync.error ? ` ${sync.error}` : ''}
        </p>

        {sync.status === 'signed-out' && (
          <form className="form" onSubmit={login}>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {message && <p className="status" role="alert">{message}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={register} disabled={busy}>
                Crear cuenta
              </button>
              <button type="submit" className="btn primary" disabled={busy}>
                Iniciar sesión
              </button>
            </div>
          </form>
        )}

        {(sync.status === 'idle' || sync.status === 'syncing' || sync.status === 'error') && (
          <>
            {sync.email && <p className="status">Sesión: {sync.email}</p>}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => void signOut()}>
                Cerrar sesión
              </button>
              <button type="button" className="btn primary" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
                Sincronizar ahora
              </button>
            </div>
          </>
        )}

        <hr />
        <button type="button" className="btn" onClick={() => void exportBackup()}>
          Descargar copia de seguridad (JSON)
        </button>
      </div>
    </Sheet>
  )
}
