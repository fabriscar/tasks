import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Corre schema.sql en un Postgres local que imita lo que trae Supabase (roles, auth.uid(), permisos por defecto)
// y comprueba que nadie puede ver ni tocar tareas ajenas ni saturar la tabla.

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const id = (n: number) => `aaaaaaaa-0000-0000-0000-${String(n).padStart(12, '0')}`

let db: PGlite

async function as<T>(role: 'anon' | 'authenticated', uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
  }
}

interface Row {
  title?: string
  notes?: string
  priority?: number
  tags?: string[]
  due_time?: string | null
  recurrence?: object | null
}

const upsert = (uid: string, taskId: string, r: Row = {}) =>
  db.query(
    `insert into public.tasks (id, user_id, title, notes, priority, tags, created_at, updated_at, due_time, recurrence)
     values ($1, $2, $3, $4, $5, $6::text[], now(), now(), $7, $8::jsonb)
     on conflict (id) do update set title = excluded.title, user_id = excluded.user_id`,
    [taskId, uid, r.title ?? 'T', r.notes ?? '', r.priority ?? 0, r.tags ?? [], r.due_time ?? null, r.recurrence ? JSON.stringify(r.recurrence) : null],
  )

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    insert into auth.users values ('${A}'), ('${B}');
  `)
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
  await db.exec(schema)
  await db.exec(schema) // debe poder ejecutarse de nuevo sin romper nada
  await as('authenticated', A, () => upsert(A, id(1), { title: 'Privada de A' }))
}, 60_000)

afterAll(() => db.close())

describe('aislamiento entre usuarios', () => {
  it('un usuario no ve las tareas de otro', async () => {
    const rows = await as('authenticated', B, () => db.query('select * from public.tasks'))
    expect(rows.rows).toHaveLength(0)
  })

  it('sin sesión (anon) no se puede leer ni escribir', async () => {
    await expect(as('anon', null, () => db.query('select * from public.tasks'))).rejects.toThrow(/permission denied/)
    await expect(as('anon', null, () => upsert(A, id(9)))).rejects.toThrow(/permission denied/)
  })

  it('no se puede crear una tarea a nombre de otro usuario', async () => {
    await expect(as('authenticated', B, () => upsert(A, id(2)))).rejects.toThrow(/row-level security/)
  })

  it('no se puede pisar una tarea ajena reutilizando su id', async () => {
    await expect(as('authenticated', B, () => upsert(B, id(1), { title: 'Hackeada' }))).rejects.toThrow(/row-level security/)
    const { rows } = await as('authenticated', A, () => db.query('select title, user_id from public.tasks where id = $1', [id(1)]))
    expect(rows[0]).toEqual({ title: 'Privada de A', user_id: A })
  })

  it('no se puede traspasar una tarea propia a otro usuario ni borrar tareas ajenas', async () => {
    await expect(
      as('authenticated', A, () => db.query('update public.tasks set user_id = $1 where id = $2', [B, id(1)])),
    ).rejects.toThrow(/row-level security/)
    const del = await as('authenticated', B, () => db.query('delete from public.tasks where id = $1', [id(1)]))
    expect(del.affectedRows).toBe(0)
  })
})

describe('topes de tamaño y formato', () => {
  const bad: [string, Row][] = [
    ['título vacío', { title: '' }],
    ['título de 501 caracteres', { title: 'x'.repeat(501) }],
    ['notas de más de 10.000 caracteres', { notes: 'x'.repeat(10_001) }],
    ['prioridad fuera de rango', { priority: 9 }],
    ['más de 20 etiquetas', { tags: Array.from({ length: 21 }, (_, i) => `t${i}`) }],
    ['hora inválida', { due_time: '25:99' }],
    ['repetición sobredimensionada', { recurrence: { x: 'y'.repeat(600) } }],
  ]

  it.each(bad)('rechaza %s', async (_label, row) => {
    await expect(as('authenticated', A, () => upsert(A, id(100), row))).rejects.toThrow(/check constraint/)
  })

  it('acepta una tarea válida con hora y repetición', async () => {
    await as('authenticated', A, () =>
      upsert(A, id(200), { due_time: '18:30', recurrence: { unit: 'week', interval: 1, weekdays: [1, 4] } }),
    )
  })

  it('synced_at lo completa el servidor, no el cliente', async () => {
    const { rows } = await as('authenticated', A, () =>
      db.query<{ fresh: boolean }>(`select synced_at > now() - interval '1 minute' as fresh from public.tasks where id = $1`, [id(1)]),
    )
    expect(rows[0].fresh).toBe(true)
  })
})
