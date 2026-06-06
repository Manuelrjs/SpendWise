-- Tarea 32: invitaciones para sumar usuarios a un grupo existente.
-- La aceptación actualiza el perfil de forma atómica, sin mover ni borrar datos del grupo anterior.

create extension if not exists pgcrypto;

create or replace function public.grupo_actual_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.grupo_id
  from public.perfiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.rol_actual_usuario()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.rol
  from public.perfiles p
  where p.id = auth.uid()
  limit 1;
$$;

create or replace function public.usuario_es_admin_grupo(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = grupo
      and p.rol = 'admin'
  );
$$;

revoke all on function public.grupo_actual_usuario() from public;
revoke all on function public.rol_actual_usuario() from public;
revoke all on function public.usuario_es_admin_grupo(uuid) from public;
grant execute on function public.grupo_actual_usuario() to authenticated;
grant execute on function public.rol_actual_usuario() to authenticated;
grant execute on function public.usuario_es_admin_grupo(uuid) to authenticated;

create table if not exists public.invitaciones_grupo (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos(id) on delete cascade,
  email_invitado text not null,
  rol text not null default 'miembro' check (rol in ('admin', 'miembro')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'cancelada', 'expirada')),
  token text not null unique,
  invitado_por uuid references auth.users(id),
  aceptado_por uuid references auth.users(id),
  creado_en timestamptz not null default now(),
  aceptado_en timestamptz,
  expira_en timestamptz default (now() + interval '7 days'),
  constraint invitaciones_grupo_email_valido check (email_invitado ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

create index if not exists invitaciones_grupo_grupo_id_idx on public.invitaciones_grupo(grupo_id);
create index if not exists invitaciones_grupo_email_idx on public.invitaciones_grupo(lower(email_invitado));
create index if not exists invitaciones_grupo_token_idx on public.invitaciones_grupo(token);
create unique index if not exists invitaciones_grupo_pendiente_email_unica_idx
  on public.invitaciones_grupo(grupo_id, lower(email_invitado))
  where estado = 'pendiente';

create or replace function public.preparar_invitacion_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_invitado := lower(trim(new.email_invitado));
  -- El token se genera en la app antes del insert; la base solo valida y conserva el valor recibido.
  if new.token is null or length(new.token) < 32 then
    raise exception 'La invitación requiere un token seguro generado por la aplicación.';
  end if;
  new.invitado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists trigger_preparar_invitacion_grupo on public.invitaciones_grupo;
create trigger trigger_preparar_invitacion_grupo
before insert on public.invitaciones_grupo
for each row execute function public.preparar_invitacion_grupo();

create or replace function public.proteger_grupo_y_rol_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.id
    and old.grupo_id is not null
    and (new.grupo_id is distinct from old.grupo_id or new.rol is distinct from old.rol)
    and coalesce(current_setting('spendwise.aceptando_invitacion', true), '') <> '1' then
    raise exception 'No podés cambiar tu grupo o rol sin una invitación válida.';
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_proteger_grupo_y_rol_perfil on public.perfiles;
create trigger trigger_proteger_grupo_y_rol_perfil
before update on public.perfiles
for each row execute function public.proteger_grupo_y_rol_perfil();

create or replace function public.validar_cambio_invitacion_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_usuario text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if new.grupo_id <> old.grupo_id
    or new.email_invitado <> old.email_invitado
    or new.rol <> old.rol
    or new.token <> old.token
    or new.invitado_por is distinct from old.invitado_por
    or new.creado_en <> old.creado_en
    or new.expira_en is distinct from old.expira_en then
    raise exception 'No se pueden modificar los datos de una invitación creada.';
  end if;

  if old.estado <> 'pendiente' then
    raise exception 'Esta invitación ya no está disponible.';
  end if;

  if new.estado = 'cancelada' then
    if not public.usuario_es_admin_grupo(old.grupo_id) then
      raise exception 'Solo un administrador puede cancelar la invitación.';
    end if;
    new.aceptado_por := null;
    new.aceptado_en := null;
    return new;
  end if;

  if new.estado = 'aceptada' then
    if email_usuario = '' or email_usuario <> lower(old.email_invitado) then
      raise exception 'Esta invitación pertenece a otro email.';
    end if;
    if old.expira_en is not null and old.expira_en <= now() then
      raise exception 'Esta invitación ya no está disponible.';
    end if;
    if new.aceptado_por is distinct from auth.uid() then
      raise exception 'La invitación debe ser aceptada por el usuario autenticado.';
    end if;

    new.aceptado_en := now();
    perform set_config('spendwise.aceptando_invitacion', '1', true);
    update public.perfiles
    set grupo_id = old.grupo_id,
        rol = old.rol,
        email = coalesce(email, email_usuario),
        actualizado_en = now()
    where id = auth.uid();

    if not found then
      raise exception 'No se encontró el perfil del usuario invitado.';
    end if;
    return new;
  end if;

  raise exception 'Cambio de estado de invitación no permitido.';
end;
$$;

drop trigger if exists trigger_validar_cambio_invitacion_grupo on public.invitaciones_grupo;
create trigger trigger_validar_cambio_invitacion_grupo
before update on public.invitaciones_grupo
for each row execute function public.validar_cambio_invitacion_grupo();



-- Consulta controlada por token para que el destinatario pueda distinguir un email incorrecto.
create or replace function public.consultar_invitacion_grupo(token_invitacion text)
returns table (
  id uuid,
  grupo_id uuid,
  email_invitado text,
  rol text,
  estado text,
  expira_en timestamptz,
  grupo_nombre text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.grupo_id, i.email_invitado, i.rol, i.estado, i.expira_en, g.nombre
  from public.invitaciones_grupo i
  join public.grupos g on g.id = i.grupo_id
  where i.token = token_invitacion
  limit 1;
$$;

revoke all on function public.consultar_invitacion_grupo(text) from public;
grant execute on function public.consultar_invitacion_grupo(text) to authenticated;

alter table public.invitaciones_grupo enable row level security;

-- Los integrantes pueden ver las invitaciones del grupo; el destinatario puede leer la suya por token.
drop policy if exists invitaciones_select_grupo on public.invitaciones_grupo;
create policy invitaciones_select_grupo on public.invitaciones_grupo
for select to authenticated
using (
  grupo_id = public.grupo_actual_usuario()
  or lower(email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists invitaciones_insert_admin on public.invitaciones_grupo;
create policy invitaciones_insert_admin on public.invitaciones_grupo
for insert to authenticated
with check (
  public.usuario_es_admin_grupo(grupo_id)
  and estado = 'pendiente'
  and rol in ('admin', 'miembro')
);

drop policy if exists invitaciones_cancelar_admin on public.invitaciones_grupo;
create policy invitaciones_cancelar_admin on public.invitaciones_grupo
for update to authenticated
using (estado = 'pendiente' and public.usuario_es_admin_grupo(grupo_id))
with check (estado = 'cancelada' and public.usuario_es_admin_grupo(grupo_id));

drop policy if exists invitaciones_aceptar_destinatario on public.invitaciones_grupo;
create policy invitaciones_aceptar_destinatario on public.invitaciones_grupo
for update to authenticated
using (
  estado = 'pendiente'
  and lower(email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
  and (expira_en is null or expira_en > now())
)
with check (
  estado = 'aceptada'
  and aceptado_por = auth.uid()
  and lower(email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Permitir listar miembros del grupo sin abrir perfiles de otros grupos.
drop policy if exists perfiles_select_mismo_grupo on public.perfiles;
create policy perfiles_select_mismo_grupo on public.perfiles
for select to authenticated
using (grupo_id = public.grupo_actual_usuario());

-- Un usuario no puede cambiar por sí solo su grupo o rol para eludir una invitación.
drop policy if exists perfiles_update_propios on public.perfiles;
create policy perfiles_update_propios on public.perfiles
for update to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and grupo_id = public.grupo_actual_usuario()
  and rol = public.rol_actual_usuario()
);
