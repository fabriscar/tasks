import { createClient } from '@supabase/supabase-js'
import type { Remote, RemoteTask } from './sync'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

const PAGE = 1000

export function supabaseRemote(): Remote {
  if (!supabase) throw new Error('Supabase no está configurado')
  const client = supabase
  return {
    async push(rows) {
      const { error } = await client.from('tasks').upsert(rows, { onConflict: 'id' })
      if (error) throw new Error(error.message)
    },
    async pull(since) {
      const out: RemoteTask[] = []
      for (let from = 0; ; from += PAGE) {
        let query = client.from('tasks').select('*').order('synced_at').order('id').range(from, from + PAGE - 1)
        if (since) query = query.gt('synced_at', since)
        const { data, error } = await query
        if (error) throw new Error(error.message)
        out.push(...(data as RemoteTask[]))
        if (data.length < PAGE) return out
      }
    },
  }
}
