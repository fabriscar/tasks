import type { Table } from 'dexie'
import { db } from './db'

/** Todo lo que se sincroniza tiene estos campos: última edición, borrado lógico y marca de pendiente. */
export interface Syncable {
  id: string
  updatedAt: string
  deletedAt: string | null
  dirty: 0 | 1
}

/** Fila tal como vive en Supabase (snake_case). Toda tabla remota tiene `id`, `user_id`, `updated_at` y `synced_at`. */
export type RemoteRow = { id: string; updated_at: string; synced_at?: string } & Record<string, unknown>

/** Cómo se sincroniza una tabla. Cada módulo define la suya y la registra en `src/modules/index.ts`. */
export interface SyncTableDef<L extends Syncable = any> {
  /** Nombre de la tabla en Supabase. */
  remote: string
  /** Columnas de la clave primaria remota, para el upsert. */
  conflict: string
  /** Clave en `meta` donde se guarda hasta dónde se bajó. */
  cursorKey: string
  local: () => Table<L, string, L>
  toRemote(row: L, userId: string): RemoteRow
  fromRemote(row: RemoteRow): L
}

export interface Remote {
  push(table: string, conflict: string, rows: RemoteRow[]): Promise<void>
  /** Todas las filas de `table` con synced_at posterior a `since`, ordenadas por synced_at. */
  pull(table: string, since: string | null): Promise<RemoteRow[]>
}

const registry: SyncTableDef[] = []

export function registerSyncTable(def: SyncTableDef): void {
  if (!registry.some((d) => d.remote === def.remote)) registry.push(def)
}

export const syncTables = () => registry

const OVERLAP_MS = 5_000
const BATCH = 200

/** Postgres devuelve microsegundos; Date.parse solo es confiable con milisegundos. */
export const ts = (s: string) => Date.parse(s.replace(/(\.\d{3})\d+/, '$1'))
export const iso = (s: string | null | undefined) => (s ? new Date(ts(s)).toISOString() : null)

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function syncTable(remote: Remote, def: SyncTableDef, userId: string): Promise<{ pushed: number; pulled: number }> {
  const local = def.local()
  let pushed = 0

  const dirty = await local.where('dirty').equals(1).toArray()
  for (const batch of chunk(dirty, BATCH)) {
    await remote.push(def.remote, def.conflict, batch.map((row) => def.toRemote(row, userId)))
    // Si algo se volvió a editar mientras subía, queda pendiente para la próxima pasada.
    await db.transaction('rw', local, async () => {
      for (const row of batch) {
        const current = await local.get(row.id)
        if (current && current.updatedAt === row.updatedAt) await local.update(row.id, { dirty: 0 })
      }
    })
    pushed += batch.length
  }

  const cursor = (await db.meta.get(def.cursorKey))?.value as string | undefined
  const since = cursor ? new Date(ts(cursor) - OVERLAP_MS).toISOString() : null
  const rows = await remote.pull(def.remote, since)

  await db.transaction('rw', local, db.meta, async () => {
    let newest = cursor ? ts(cursor) : -Infinity
    let newestRaw = cursor
    for (const r of rows) {
      const current = await local.get(r.id)
      if (!(current?.dirty && ts(current.updatedAt) > ts(r.updated_at))) {
        await local.put(def.fromRemote(r))
      }
      if (r.synced_at && ts(r.synced_at) > newest) {
        newest = ts(r.synced_at)
        newestRaw = r.synced_at
      }
    }
    if (newestRaw && newestRaw !== cursor) await db.meta.put({ key: def.cursorKey, value: newestRaw })
  })

  return { pushed, pulled: rows.length }
}

/**
 * Una pasada de sincronización: por cada tabla sube lo pendiente y baja lo nuevo.
 * Ante un conflicto gana la edición más reciente (por updatedAt) de cada registro.
 * Un error en una tabla no impide sincronizar las otras; se informa al final.
 */
export async function syncOnce(
  remote: Remote,
  userId: string,
  tables: SyncTableDef[] = registry,
): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0
  let pulled = 0
  const errors: unknown[] = []
  for (const def of tables) {
    try {
      const result = await syncTable(remote, def, userId)
      pushed += result.pushed
      pulled += result.pulled
    } catch (e) {
      errors.push(e)
    }
  }
  if (errors.length) throw errors[0]
  return { pushed, pulled }
}

async function clearEverything(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
}

/**
 * Los datos locales pertenecen a una sola cuenta. Si en este dispositivo inicia sesión otra cuenta,
 * se descartan los datos de la anterior para no subirlos (ni mostrarlos) en la cuenta nueva.
 * Lo creado antes de iniciar sesión por primera vez pasa a ser de esa cuenta.
 */
export async function claimLocalData(userId: string): Promise<void> {
  const owner = (await db.meta.get('owner'))?.value
  if (owner && owner !== userId) await clearEverything()
  await db.meta.put({ key: 'owner', value: userId })
}

/** Borra todo lo guardado en este dispositivo. */
export async function wipeLocalData(): Promise<void> {
  await clearEverything()
}
