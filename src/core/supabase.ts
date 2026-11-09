import { createClient } from '@supabase/supabase-js'
import { publicEnvProblem } from './keyGuard'
import type { Remote, RemoteRow } from './sync'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Última barrera: si por error se publicó una clave de administrador, la app se niega a usarla.
const keyProblem = anonKey ? publicEnvProblem('VITE_SUPABASE_ANON_KEY', anonKey) : null
if (keyProblem) console.error(`Sincronización desactivada: la clave configurada ${keyProblem}`)

export const supabase =
  url && anonKey && !keyProblem
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          // Solo se inicia sesión con email y contraseña desde el formulario: nunca desde tokens en la URL.
          detectSessionInUrl: false,
        },
      })
    : null

const PAGE = 1000

export function supabaseRemote(): Remote {
  if (!supabase) throw new Error('Supabase no está configurado')
  const client = supabase
  return {
    async push(table, conflict, rows) {
      const { error } = await client.from(table).upsert(rows, { onConflict: conflict })
      if (error) throw new Error(error.message)
    },
    async pull(table, since) {
      const out: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let query = client.from(table).select('*').order('synced_at').order('id').range(from, from + PAGE - 1)
        if (since) query = query.gt('synced_at', since)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        out.push(...(data as RemoteRow[]))
        if (data.length < PAGE) return out
      }
    },
  }
}
