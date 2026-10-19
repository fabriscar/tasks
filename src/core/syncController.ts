import { useSyncExternalStore } from 'react'
import { onLocalChange } from './events'
import { supabase, supabaseRemote } from './supabase'
import { syncOnce } from './sync'

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

/** Devuelve un mensaje de error, o null si salió bien. `needsConfirmation` avisa si hay que confirmar por mail. */
export async function signUp(
  email: string,
  password: string,
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  if (!supabase) return { error: 'La sincronización no está configurada.', needsConfirmation: false }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { error: error.message, needsConfirmation: false }
  if (data.session) void syncNow()
  return { error: null, needsConfirmation: !data.session }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
  setState({ status: 'signed-out', email: null, error: null })
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
