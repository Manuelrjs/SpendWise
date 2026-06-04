-- Corrección urgente: metadata de comprobantes y RLS por grupo.
-- No borra datos existentes. Agrega columnas faltantes y deja compatibilidad
-- con comprobantes antiguos que usaban ruta_storage / tamano_bytes.

alter table public.comprobantes
add column if not exists grupo_id uuid references public.grupos(id);

alter table public.comprobantes
add column if not exists nombre_archivo text;

alter table public.comprobantes
add column if not exists tipo_archivo text;

alter table public.comprobantes
add column if not exists mime_type text;

alter table public.comprobantes
add column if not exists storage_path text;

alter table public.comprobantes
add column if not exists "tamaño_bytes" bigint;

alter table public.comprobantes
add column if not exists creado_en timestamptz not null default now();

alter table public.comprobantes
add column if not exists actualizado_en timestamptz not null default now();

update public.comprobantes c
set grupo_id = g.grupo_id
from public.gastos g
where c.gasto_id = g.id
  and c.grupo_id is null
  and g.grupo_id is not null;

update public.comprobantes
set mime_type = coalesce(mime_type, tipo_archivo),
    storage_path = coalesce(storage_path, ruta_storage),
    "tamaño_bytes" = coalesce("tamaño_bytes", tamano_bytes::bigint)
where mime_type is null
   or storage_path is null
   or "tamaño_bytes" is null;

create index if not exists comprobantes_grupo_id_idx on public.comprobantes (grupo_id);
create index if not exists comprobantes_gasto_id_idx on public.comprobantes (gasto_id);
create index if not exists comprobantes_storage_path_idx on public.comprobantes (storage_path);

alter table public.comprobantes enable row level security;

drop policy if exists "comprobantes_select_by_group" on public.comprobantes;
drop policy if exists "comprobantes_insert_by_group" on public.comprobantes;
drop policy if exists "comprobantes_update_by_group" on public.comprobantes;
drop policy if exists comprobantes_select_por_grupo on public.comprobantes;
drop policy if exists comprobantes_insert_por_grupo on public.comprobantes;
drop policy if exists comprobantes_update_por_grupo on public.comprobantes;

create policy "comprobantes_select_by_group"
on public.comprobantes
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = comprobantes.grupo_id
  )
);

create policy "comprobantes_insert_by_group"
on public.comprobantes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = comprobantes.grupo_id
  )
);

create policy "comprobantes_update_by_group"
on public.comprobantes
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = comprobantes.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = comprobantes.grupo_id
  )
);
