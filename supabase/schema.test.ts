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

describe('hábitos, días marcados y notas', () => {
  const H = 'bbbbbbbb-0000-0000-0000-000000000001'
  const dayLogId = (habit: string, date: string) => `${habit}:${date}`

  const habit = (uid: string, habitId: string, name = 'Leer') =>
    db.query(
      `insert into public.habits (id, user_id, name, position, created_on, created_at, updated_at)
       values ($1, $2, $3, 0, '2026-11-01', now(), now())
       on conflict (user_id, id) do update set name = excluded.name`,
      [habitId, uid, name],
    )
  const logRow = (uid: string, habitId: string, date: string, idOverride?: string) =>
    db.query(
      `insert into public.habit_logs (id, user_id, habit_id, date, created_at, updated_at)
       values ($1, $2, $3, $4, now(), now())
       on conflict (user_id, id) do update set updated_at = now()`,
      [idOverride ?? dayLogId(habitId, date), uid, habitId, date],
    )
  const noteRow = (uid: string, date: string, text: string) =>
    db.query(
      `insert into public.day_notes (id, user_id, text, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (user_id, id) do update set text = excluded.text`,
      [date, uid, text],
    )

  beforeAll(async () => {
    await as('authenticated', A, async () => {
      await habit(A, H)
      await logRow(A, H, '2026-11-02')
      await noteRow(A, '2026-11-09', 'Cobré mi sueldo')
    })
  })

  it('cada usuario ve solo lo suyo en las tres tablas', async () => {
    for (const table of ['habits', 'habit_logs', 'day_notes']) {
      const { rows } = await as('authenticated', B, () => db.query(`select * from public.${table}`))
      expect(rows).toHaveLength(0)
    }
  })

  it('sin sesión (anon) no hay acceso', async () => {
    for (const table of ['habits', 'habit_logs', 'day_notes']) {
      await expect(as('anon', null, () => db.query(`select * from public.${table}`))).rejects.toThrow(/permission denied/)
    }
  })

  it('dos usuarios pueden tener una nota en la misma fecha sin pisarse', async () => {
    await as('authenticated', B, () => noteRow(B, '2026-11-09', 'Nota de B'))
    const a = await as('authenticated', A, () => db.query('select text from public.day_notes'))
    const b = await as('authenticated', B, () => db.query('select text from public.day_notes'))
    expect(a.rows).toEqual([{ text: 'Cobré mi sueldo' }])
    expect(b.rows).toEqual([{ text: 'Nota de B' }])
  })

  it('no se puede escribir a nombre de otro usuario', async () => {
    await expect(as('authenticated', B, () => habit(A, 'bbbbbbbb-0000-0000-0000-000000000002'))).rejects.toThrow(/row-level security/)
    await expect(as('authenticated', B, () => noteRow(A, '2026-11-10', 'x'))).rejects.toThrow(/row-level security/)
  })

  it('rechaza datos fuera de formato o tamaño', async () => {
    const bad: [string, () => Promise<unknown>][] = [
      ['nombre de hábito vacío', () => habit(A, 'bbbbbbbb-0000-0000-0000-000000000003', '')],
      ['nombre de hábito de 61 caracteres', () => habit(A, 'bbbbbbbb-0000-0000-0000-000000000004', 'x'.repeat(61))],
      ['id de día que no coincide con hábito y fecha', () => logRow(A, H, '2026-11-03', `${H}:2026-11-04`)],
      ['nota con fecha mal escrita', () => noteRow(A, '09/11/2026', 'x')],
      ['nota vacía', () => noteRow(A, '2026-11-11', '')],
      ['nota de 501 caracteres', () => noteRow(A, '2026-11-12', 'x'.repeat(501))],
    ]
    for (const [label, run] of bad) {
      await expect(as('authenticated', A, run), label).rejects.toThrow(/check constraint/)
    }
  })

  it('synced_at lo completa el servidor en las tres tablas', async () => {
    for (const table of ['habits', 'habit_logs', 'day_notes']) {
      const { rows } = await as('authenticated', A, () =>
        db.query<{ fresh: boolean }>(`select synced_at > now() - interval '1 minute' as fresh from public.${table}`),
      )
      expect(rows.every((r) => r.fresh)).toBe(true)
    }
  })
})
