-- Tabla de tareas para la sincronización. Pegar completo en Supabase > SQL Editor > Run.
-- Es seguro volver a ejecutarlo.

create table if not exists public.tasks (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,
  notes       text not null default '',
  due_date    date,
  due_time    text,
  priority    smallint not null default 0,
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

-- Topes de tamaño: acotan el daño si alguien con una cuenta intenta llenar la base.
-- Coinciden con LIMITS en src/modules/tasks/repo.ts.
alter table public.tasks drop constraint if exists tasks_title_len;
alter table public.tasks add constraint tasks_title_len check (char_length(title) between 1 and 500);

alter table public.tasks drop constraint if exists tasks_notes_len;
alter table public.tasks add constraint tasks_notes_len check (char_length(notes) <= 10000);

alter table public.tasks drop constraint if exists tasks_priority_range;
alter table public.tasks add constraint tasks_priority_range check (priority between 0 and 3);

alter table public.tasks drop constraint if exists tasks_tags_size;
alter table public.tasks add constraint tasks_tags_size
  check (cardinality(tags) <= 20 and char_length(array_to_string(tags, ',')) <= 1000);

alter table public.tasks drop constraint if exists tasks_due_time_format;
alter table public.tasks add constraint tasks_due_time_format
  check (due_time is null or due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

alter table public.tasks drop constraint if exists tasks_recurrence_shape;
alter table public.tasks add constraint tasks_recurrence_shape
  check (recurrence is null or (jsonb_typeof(recurrence) = 'object' and pg_column_size(recurrence) <= 500));

-- Seguridad por fila: cada usuario ve y modifica únicamente sus propias tareas.
alter table public.tasks enable row level security;

drop policy if exists "tareas propias" on public.tasks;
create policy "tareas propias" on public.tasks
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sin sesión (rol anon) no hay acceso de ningún tipo a la tabla.
revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create or replace function public.set_synced_at() returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.synced_at := now();
  return new;
end;
$$;

revoke all on function public.set_synced_at() from public, anon, authenticated;

drop trigger if exists tasks_set_synced_at on public.tasks;
create trigger tasks_set_synced_at
  before insert or update on public.tasks
  for each row execute function public.set_synced_at();
