import { useState, type FormEvent } from 'react'
import { db } from '../../../core/db'
import { todayISO } from '../../../core/dates'
import {
  MIN_PASSWORD_LENGTH,
  changePassword,
  signIn,
  signOut,
  signUp,
  syncNow,
  useSyncState,
  type SignOutScope,
} from '../../../core/syncController'
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
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const login = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    setMessage(await signIn(email.trim(), password))
    setPassword('')
    setBusy(false)
  }

  const register = async () => {
    if (!email.trim() || password.length < MIN_PASSWORD_LENGTH) {
      setMessage(`Completá el email y una contraseña de al menos ${MIN_PASSWORD_LENGTH} caracteres.`)
      return
    }
    setBusy(true)
    const result = await signUp(email.trim(), password)
    setMessage(
      result.error ??
        (result.needsConfirmation ? 'Cuenta creada. Confirmá tu email y después iniciá sesión.' : null),
    )
    setPassword('')
    setBusy(false)
  }

  const leave = async (scope: SignOutScope, question: string) => {
    if (!window.confirm(question)) return
    setBusy(true)
    setMessage(await signOut(scope))
    setBusy(false)
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const error = await changePassword(newPassword)
    setMessage(error ?? 'Contraseña actualizada.')
    if (!error) setNewPassword('')
    setBusy(false)
  }

  const signedIn = sync.status === 'idle' || sync.status === 'syncing' || sync.status === 'error'

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

        {signedIn && (
          <>
            {sync.email && <p className="status">Sesión: {sync.email}</p>}
            <div className="form-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => void signOut('device')}>
                Cerrar sesión
              </button>
              <button type="button" className="btn primary" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
                Sincronizar ahora
              </button>
            </div>
            {message && <p className="status" role="alert">{message}</p>}

            <details className="security">
              <summary>Seguridad de la cuenta</summary>
              <div className="form">
                <form className="form" onSubmit={savePassword}>
                  <label>
                    Nueva contraseña
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={MIN_PASSWORD_LENGTH}
                      required
                    />
                  </label>
                  <button type="submit" className="btn" disabled={busy}>
                    Cambiar contraseña
                  </button>
                </form>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    void leave(
                      'wipe',
                      'Se cierra la sesión y se borran las tareas guardadas en este dispositivo. Seguirán en tu cuenta. ¿Continuar?',
                    )
                  }
                >
                  Cerrar sesión y borrar datos de este dispositivo
                </button>
                <button
                  type="button"
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    void leave(
                      'everywhere',
                      'Se cierra la sesión en todos tus dispositivos, incluido este. Útil si perdiste un teléfono. ¿Continuar?',
                    )
                  }
                >
                  Cerrar sesión en todos mis dispositivos
                </button>
              </div>
            </details>
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
