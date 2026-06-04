-- Corrección de metadata de comprobantes: usar columnas estándar en español.
-- No borra archivos ni registros, no crea columnas duplicadas en inglés y mantiene compatibilidad
-- con columnas históricas si existen en algún ambiente.

alter table public.comprobantes
add column if not exists grupo_id uuid references public.grupos(id);

alter table public.comprobantes
add column if not exists nombre_archivo text;

alter table public.comprobantes
add column if not exists tipo_comprobante text;

alter table public.comprobantes
add column if not exists ruta_storage text;

alter table public.comprobantes
add column if not exists url_storage text;

alter table public.comprobantes
add column if not exists url_drive text;

alter table public.comprobantes
add column if not exists tamano_bytes integer;

alter table public.comprobantes
add column if not exists creado_en timestamptz not null default now();

alter table public.comprobantes
add column if not exists actualizado_en timestamptz not null default now();

alter table public.comprobantes
drop constraint if exists comprobantes_tipo_comprobante_check;

alter table public.comprobantes
add constraint comprobantes_tipo_comprobante_check
check (tipo_comprobante is null or tipo_comprobante in ('imagen', 'pdf', 'otro'));

-- Si una migración anterior dejó tipo_archivo obligatorio, permitir que el código use
-- tipo_comprobante sin escribir una columna duplicada de MIME/type.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comprobantes'
      and column_name = 'tipo_archivo'
  ) then
    execute 'alter table public.comprobantes alter column tipo_archivo drop not null';
    execute 'alter table public.comprobantes drop constraint if exists comprobantes_tipo_archivo_check';
  end if;
end $$;

-- Backfill no destructivo desde columnas históricas si existen.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comprobantes' and column_name = 'storage_path') then
    execute 'update public.comprobantes set ruta_storage = coalesce(ruta_storage, storage_path) where ruta_storage is null';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comprobantes' and column_name = 'tipo_archivo') then
    execute $sql$
      update public.comprobantes
      set tipo_comprobante = coalesce(
        tipo_comprobante,
        case
          when tipo_archivo ilike 'image/%' then 'imagen'
          when tipo_archivo = 'application/pdf' then 'pdf'
          else 'otro'
        end
      )
      where tipo_comprobante is null
    $sql$;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comprobantes' and column_name = 'mime_type') then
    execute $sql$
      update public.comprobantes
      set tipo_comprobante = coalesce(
        tipo_comprobante,
        case
          when mime_type ilike 'image/%' then 'imagen'
          when mime_type = 'application/pdf' then 'pdf'
          else 'otro'
        end
      )
      where tipo_comprobante is null
    $sql$;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'comprobantes' and column_name = 'tamaño_bytes') then
    execute 'update public.comprobantes set tamano_bytes = coalesce(tamano_bytes, "tamaño_bytes"::integer) where tamano_bytes is null';
  end if;
end $$;

update public.comprobantes c
set grupo_id = g.grupo_id
from public.gastos g
where c.gasto_id = g.id
  and c.grupo_id is null
  and g.grupo_id is not null;

create index if not exists comprobantes_grupo_id_idx on public.comprobantes (grupo_id);
create index if not exists comprobantes_gasto_id_idx on public.comprobantes (gasto_id);
create index if not exists comprobantes_ruta_storage_idx on public.comprobantes (ruta_storage);

alter table public.comprobantes enable row level security;

drop policy if exists "comprobantes_select_by_group" on public.comprobantes;
drop policy if exists "comprobantes_insert_by_group" on public.comprobantes;
drop policy if exists "comprobantes_update_by_group" on public.comprobantes;

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
