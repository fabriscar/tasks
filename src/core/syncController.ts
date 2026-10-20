import { useSyncExternalStore } from 'react'
import { onLocalChange } from './events'
import { supabase, supabaseRemote } from './supabase'
import { db } from './db'
import { claimLocalData, syncOnce, wipeLocalData } from './sync'

export interface SyncState {
  status: 'unconfigured' | 'signed-out' | 'idle' | 'syncing' | 'error'
  lastSyncAt: number | null
  error: string | null
  email: string | null
}

let state: SyncState = {
  status: supabase ? 'signed-out' : 'unconfigured',
  lastSyncAt: null,
  error: null,
  email: null,
}
const subscribers = new Set<() => void>()

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  subscribers.forEach((s) => s())
}

const subscribe = (cb: () => void) => {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

export const useSyncState = () => useSyncExternalStore(subscribe, () => state)

function friendlyError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (!navigator.onLine || /failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Sin conexión. Se reintenta solo.'
  }
  return message
}

let running = false
let rerun = false

export async function syncNow(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const session = data.session
  if (!session) {
    setState({ status: 'signed-out', email: null })
    return
  }
  if (running) {
    rerun = true
    return
  }
  running = true
  setState({ status: 'syncing', email: session.user.email ?? null })
  try {
    await claimLocalData(session.user.id)
    do {
      rerun = false
      await syncOnce(supabaseRemote(), session.user.id)
    } while (rerun)
    setState({ status: 'idle', lastSyncAt: Date.now(), error: null })
  } catch (e) {
    setState({ status: 'error', error: friendlyError(e) })
  } finally {
    running = false
  }
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'La sincronización no está configurada.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return error.message === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : error.message
  void syncNow()
  return null
}

export const MIN_PASSWORD_LENGTH = 10

/** Devuelve un mensaje de error, o null si salió bien. `needsConfirmation` avisa si hay que confirmar por mail. */
export async function signUp(
  email: string,
  password: string,
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  if (!supabase) return { error: 'La sincronización no está configurada.', needsConfirmation: false }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`, needsConfirmation: false }
  }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) {
    const closed = error.code === 'signup_disabled' || /signups? not allowed/i.test(error.message)
    return {
      error: closed ? 'El registro está cerrado. Iniciá sesión con la cuenta que ya creaste.' : error.message,
      needsConfirmation: false,
    }
  }
  if (data.session) void syncNow()
  return { error: null, needsConfirmation: !data.session }
}

export type SignOutScope = 'device' | 'wipe' | 'everywhere'

/**
 * - device: cierra la sesión solo en este dispositivo (los otros siguen abiertos).
 * - wipe: además borra las tareas guardadas acá. Se niega si hay cambios sin subir, para no perderlos.
 * - everywhere: invalida la sesión en todos los dispositivos (para un teléfono perdido o una contraseña filtrada).
 */
export async function signOut(scope: SignOutScope = 'device'): Promise<string | null> {
  if (!supabase) return null
  if (scope === 'wipe') {
    await syncNow()
    const pending = await db.tasks.where('dirty').equals(1).count()
    if (pending > 0) {
      return `Hay ${pending} ${pending === 1 ? 'cambio' : 'cambios'} sin sincronizar. Conectate a internet y probá de nuevo para no perderlos.`
    }
  }
  const { error } = await supabase.auth.signOut({ scope: scope === 'everywhere' ? 'global' : 'local' })
  if (error) return error.message
  if (scope === 'wipe') await wipeLocalData()
  setState({ status: 'signed-out', email: null, error: null })
  return null
}

export async function changePassword(password: string): Promise<string | null> {
  if (!supabase) return 'La sincronización no está configurada.'
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`
  const { error } = await supabase.auth.updateUser({ password })
  return error ? error.message : null
}

let started = false
let debounce: ReturnType<typeof setTimeout> | undefined

export function startSync(): void {
  if (started || !supabase) return
  started = true

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) void syncNow()
    else setState({ status: 'signed-out', email: null })
  })

  onLocalChange(() => {
    clearTimeout(debounce)
    debounce = setTimeout(() => void syncNow(), 1500)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => void syncNow())
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)

  void syncNow()
}
