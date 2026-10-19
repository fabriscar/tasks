-- Tabla de tareas para la sincronización. Pegar completo en Supabase > SQL Editor > Run.
-- Es seguro volver a ejecutarlo.

create table if not exists public.tasks (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  notes       text not null default '',
  due_date    date,
  due_time    text,
  priority    smallint not null default 0 check (priority between 0 and 3),
  tags        text[] not null default '{}',
  recurrence  jsonb,
  done_at     timestamptz,
  created_at  timestamptz not null,
  updated_at  timestamptz not null,
  deleted_at  timestamptz,
  -- Lo completa el servidor en cada escritura; la app lo usa para pedir solo lo nuevo.
  synced_at   timestamptz not null default now()
);

create index if not exists tasks_user_synced_idx on public.tasks (user_id, synced_at);

alter table public.tasks enable row level security;

-- Cada usuario ve y modifica únicamente sus propias tareas.
drop policy if exists "tareas propias" on public.tasks;
create policy "tareas propias" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_synced_at() returns trigger
language plpgsql as $$
begin
  new.synced_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_synced_at on public.tasks;
create trigger tasks_set_synced_at
  before insert or update on public.tasks
  for each row execute function public.set_synced_at();
