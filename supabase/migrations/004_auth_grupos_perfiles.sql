-- Tarea: Corrección urgente de auth con grupos/perfiles

create extension if not exists pgcrypto;

create table if not exists public.grupos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  nombre text,
  email text,
  rol text not null default 'admin',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists perfiles_grupo_id_idx on public.perfiles(grupo_id);
create index if not exists perfiles_email_idx on public.perfiles(email);

create or replace function public.actualizar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trigger_grupos_actualizado_en on public.grupos;
create trigger trigger_grupos_actualizado_en
before update on public.grupos
for each row execute function public.actualizar_actualizado_en();

drop trigger if exists trigger_perfiles_actualizado_en on public.perfiles;
create trigger trigger_perfiles_actualizado_en
before update on public.perfiles
for each row execute function public.actualizar_actualizado_en();

alter table public.grupos enable row level security;
alter table public.perfiles enable row level security;

drop policy if exists perfiles_select_propios on public.perfiles;
create policy perfiles_select_propios
on public.perfiles
for select
using (auth.uid() = id);

drop policy if exists perfiles_insert_propios on public.perfiles;
create policy perfiles_insert_propios
on public.perfiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists perfiles_update_propios on public.perfiles;
create policy perfiles_update_propios
on public.perfiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists grupos_insert_authenticated on public.grupos;
create policy grupos_insert_authenticated
on public.grupos
for insert
to authenticated
with check (auth.role() = 'authenticated');

drop policy if exists grupos_select_por_perfil on public.grupos;
create policy grupos_select_por_perfil
on public.grupos
for select
using (
  exists (
    select 1
    from public.perfiles p
    where p.grupo_id = grupos.id
      and p.id = auth.uid()
  )
);

drop policy if exists grupos_update_admin on public.grupos;
create policy grupos_update_admin
on public.grupos
for update
using (
  exists (
    select 1
    from public.perfiles p
    where p.grupo_id = grupos.id
      and p.id = auth.uid()
      and p.rol = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.grupo_id = grupos.id
      and p.id = auth.uid()
      and p.rol = 'admin'
  )
);
