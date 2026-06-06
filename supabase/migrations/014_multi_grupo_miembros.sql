-- Tarea 33: membresías multi-grupo y selección segura del grupo activo.
-- perfiles.grupo_id se conserva como grupo activo; miembros_grupo es la fuente de pertenencia.

create table if not exists public.miembros_grupo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  email text,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint miembros_grupo_grupo_usuario_unique unique (grupo_id, usuario_id)
);

create index if not exists miembros_grupo_grupo_id_idx on public.miembros_grupo(grupo_id);
create index if not exists miembros_grupo_usuario_id_idx on public.miembros_grupo(usuario_id);
create index if not exists miembros_grupo_email_idx on public.miembros_grupo(email);

drop trigger if exists trigger_miembros_grupo_actualizado_en on public.miembros_grupo;
create trigger trigger_miembros_grupo_actualizado_en
before update on public.miembros_grupo
for each row execute function public.actualizar_actualizado_en();

-- Recupera todas las pertenencias activas que todavía estaban representadas solo por perfiles.
insert into public.miembros_grupo (grupo_id, usuario_id, email, rol, estado)
select p.grupo_id, p.id, p.email, case when p.rol = 'admin' then 'admin' else 'miembro' end, 'activo'
from public.perfiles p
where p.grupo_id is not null
on conflict (grupo_id, usuario_id) do update
set email = coalesce(public.miembros_grupo.email, excluded.email),
    actualizado_en = now();

create or replace function public.usuario_tiene_membresia_activa(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros_grupo m
    where m.grupo_id = grupo and m.usuario_id = auth.uid() and m.estado = 'activo'
  );
$$;

create or replace function public.usuario_es_admin_grupo(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.miembros_grupo m
    where m.grupo_id = grupo
      and m.usuario_id = auth.uid()
      and m.estado = 'activo'
      and m.rol = 'admin'
  );
$$;

revoke all on function public.usuario_tiene_membresia_activa(uuid) from public;
revoke all on function public.usuario_es_admin_grupo(uuid) from public;
grant execute on function public.usuario_tiene_membresia_activa(uuid) to authenticated;
grant execute on function public.usuario_es_admin_grupo(uuid) to authenticated;

alter table public.miembros_grupo enable row level security;

drop policy if exists miembros_grupo_select_propias on public.miembros_grupo;
create policy miembros_grupo_select_propias on public.miembros_grupo
for select to authenticated
using (usuario_id = auth.uid());

drop policy if exists miembros_grupo_select_grupos_propios on public.miembros_grupo;
create policy miembros_grupo_select_grupos_propios on public.miembros_grupo
for select to authenticated
using (public.usuario_tiene_membresia_activa(grupo_id));

drop policy if exists miembros_grupo_insert_admin on public.miembros_grupo;
create policy miembros_grupo_insert_admin on public.miembros_grupo
for insert to authenticated
with check (public.usuario_es_admin_grupo(grupo_id));

drop policy if exists miembros_grupo_update_admin on public.miembros_grupo;
create policy miembros_grupo_update_admin on public.miembros_grupo
for update to authenticated
using (public.usuario_es_admin_grupo(grupo_id))
with check (public.usuario_es_admin_grupo(grupo_id));

-- ensureUserProfile llama esta función después de crear o cargar el perfil.
create or replace function public.asegurar_membresia_perfil_actual()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  perfil_actual public.perfiles%rowtype;
begin
  select * into perfil_actual from public.perfiles where id = auth.uid();
  if perfil_actual.id is null or perfil_actual.grupo_id is null then
    raise exception 'No se encontró el perfil o grupo activo del usuario.';
  end if;

  insert into public.miembros_grupo (grupo_id, usuario_id, email, rol, estado)
  values (
    perfil_actual.grupo_id,
    perfil_actual.id,
    perfil_actual.email,
    case when perfil_actual.rol = 'admin' then 'admin' else 'miembro' end,
    'activo'
  )
  on conflict (grupo_id, usuario_id) do update
  set email = coalesce(excluded.email, public.miembros_grupo.email),
      estado = 'activo',
      actualizado_en = now();
end;
$$;

revoke all on function public.asegurar_membresia_perfil_actual() from public;
grant execute on function public.asegurar_membresia_perfil_actual() to authenticated;

-- Cambiar el grupo activo solo es válido para una membresía activa y sincroniza el rol del perfil.
create or replace function public.cambiar_grupo_activo(nuevo_grupo_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo_rol text;
begin
  select m.rol into nuevo_rol
  from public.miembros_grupo m
  where m.grupo_id = nuevo_grupo_id
    and m.usuario_id = auth.uid()
    and m.estado = 'activo';

  if nuevo_rol is null then
    raise exception 'No pertenecés al grupo seleccionado.';
  end if;

  perform set_config('spendwise.cambiando_grupo_activo', '1', true);
  update public.perfiles
  set grupo_id = nuevo_grupo_id, rol = nuevo_rol, actualizado_en = now()
  where id = auth.uid();

  if not found then raise exception 'No se encontró el perfil del usuario.'; end if;
end;
$$;

revoke all on function public.cambiar_grupo_activo(uuid) from public;
grant execute on function public.cambiar_grupo_activo(uuid) to authenticated;

-- La aceptación agrega/actualiza una membresía, pero nunca cambia automáticamente el grupo activo.
create or replace function public.validar_cambio_invitacion_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_usuario text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if new.grupo_id <> old.grupo_id or new.email_invitado <> old.email_invitado or new.rol <> old.rol
    or new.token <> old.token or new.invitado_por is distinct from old.invitado_por
    or new.creado_en <> old.creado_en or new.expira_en is distinct from old.expira_en then
    raise exception 'No se pueden modificar los datos de una invitación creada.';
  end if;

  if old.estado <> 'pendiente' then raise exception 'Esta invitación ya no está disponible.'; end if;

  if new.estado = 'cancelada' then
    if not public.usuario_es_admin_grupo(old.grupo_id) then raise exception 'Solo un administrador puede cancelar la invitación.'; end if;
    new.aceptado_por := null;
    new.aceptado_en := null;
    return new;
  end if;

  if new.estado = 'aceptada' then
    if email_usuario = '' or email_usuario <> lower(old.email_invitado) then raise exception 'Esta invitación pertenece a otro email.'; end if;
    if old.expira_en is not null and old.expira_en <= now() then raise exception 'Esta invitación ya no está disponible.'; end if;
    if new.aceptado_por is distinct from auth.uid() then raise exception 'La invitación debe ser aceptada por el usuario autenticado.'; end if;

    insert into public.miembros_grupo (grupo_id, usuario_id, email, rol, estado)
    values (old.grupo_id, auth.uid(), email_usuario, old.rol, 'activo')
    on conflict (grupo_id, usuario_id) do update
    set email = excluded.email, rol = excluded.rol, estado = 'activo', actualizado_en = now();

    new.aceptado_en := now();
    return new;
  end if;

  raise exception 'Cambio de estado de invitación no permitido.';
end;
$$;

-- Reemplaza la protección anterior: un cambio de grupo directo solo se admite dentro del RPC seguro.
create or replace function public.proteger_grupo_y_rol_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and (new.grupo_id is distinct from old.grupo_id or new.rol is distinct from old.rol)
    and coalesce(current_setting('spendwise.cambiando_grupo_activo', true), '') <> '1' then
    raise exception 'Usá el selector de grupo para cambiar tu grupo activo.';
  end if;
  return new;
end;
$$;

-- Los grupos pueden leerse si forman parte de las membresías activas del usuario.
drop policy if exists grupos_select_por_perfil on public.grupos;
create policy grupos_select_por_perfil on public.grupos
for select to authenticated
using (public.usuario_tiene_membresia_activa(id));

-- Las invitaciones y perfiles visibles siguen limitados al grupo activo para no ampliar el contexto operativo.
drop policy if exists invitaciones_select_grupo on public.invitaciones_grupo;
create policy invitaciones_select_grupo on public.invitaciones_grupo
for select to authenticated
using (
  grupo_id = public.grupo_actual_usuario()
  or lower(email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists perfiles_select_mismo_grupo on public.perfiles;
create policy perfiles_select_mismo_grupo on public.perfiles
for select to authenticated
using (grupo_id = public.grupo_actual_usuario());

-- Recuperación manual del caso previo: insertar ambas membresías y usar cambiar_grupo_activo(...).
-- Nunca se mueven ni reasignan gastos al ejecutar esta migración.
