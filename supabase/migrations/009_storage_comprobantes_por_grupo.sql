-- Tarea 31: organizar y proteger comprobantes en Supabase Storage por grupo_id.

alter table public.comprobantes add column if not exists grupo_id uuid references public.grupos(id);
alter table public.comprobantes add column if not exists mime_type text;
alter table public.comprobantes add column if not exists storage_path text;
alter table public.comprobantes add column if not exists tamano_bytes integer;

update public.comprobantes
set mime_type = coalesce(mime_type, tipo_archivo),
    storage_path = coalesce(storage_path, ruta_storage)
where mime_type is null or storage_path is null;

create index if not exists comprobantes_grupo_id_idx on public.comprobantes (grupo_id);
create index if not exists comprobantes_storage_path_idx on public.comprobantes (storage_path);

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do update set public = false;

-- En storage.objects.name el bucket no forma parte del path. Para el bucket "comprobantes",
-- un objeto subido a comprobantes/{grupo_id}/{año}/{mes}/{gasto_id}/{archivo}
-- se guarda con name = {grupo_id}/{año}/{mes}/{gasto_id}/{archivo}.
-- Por eso storage.foldername(name)[1] debe coincidir con perfiles.grupo_id.

drop policy if exists "comprobantes_storage_select_by_group" on storage.objects;
drop policy if exists "comprobantes_storage_insert_by_group" on storage.objects;
drop policy if exists "comprobantes_storage_update_by_group" on storage.objects;
drop policy if exists "comprobantes_storage_delete_by_group" on storage.objects;

create policy "comprobantes_storage_select_by_group"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'comprobantes'
  and exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id::text = (storage.foldername(name))[1]
  )
);

create policy "comprobantes_storage_insert_by_group"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'comprobantes'
  and array_length(storage.foldername(name), 1) >= 4
  and exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id::text = (storage.foldername(name))[1]
  )
);

create policy "comprobantes_storage_update_by_group"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'comprobantes'
  and exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id::text = (storage.foldername(name))[1]
  )
)
with check (
  bucket_id = 'comprobantes'
  and array_length(storage.foldername(name), 1) >= 4
  and exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id::text = (storage.foldername(name))[1]
  )
);

create policy "comprobantes_storage_delete_by_group"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'comprobantes'
  and exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id::text = (storage.foldername(name))[1]
  )
);
