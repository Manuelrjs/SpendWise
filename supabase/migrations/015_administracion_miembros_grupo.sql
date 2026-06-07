-- Tarea 34: administración segura de miembros del grupo.
-- Las operaciones sensibles se centralizan en RPC para validar admin y no dejar grupos sin administrador.

create or replace function public.validar_actualizacion_miembro_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id <> old.id or new.grupo_id <> old.grupo_id or new.usuario_id <> old.usuario_id
    or new.creado_en <> old.creado_en then
    raise exception 'No se puede cambiar la identidad de una membresía.';
  end if;

  if old.estado = 'activo' and old.rol = 'admin'
    and (new.estado <> 'activo' or new.rol <> 'admin')
    and not exists (
      select 1 from public.miembros_grupo otro
      where otro.grupo_id = old.grupo_id
        and otro.id <> old.id
        and otro.estado = 'activo'
        and otro.rol = 'admin'
    ) then
    raise exception 'El grupo debe tener al menos un administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_validar_actualizacion_miembro_grupo on public.miembros_grupo;
create trigger trigger_validar_actualizacion_miembro_grupo
before update on public.miembros_grupo
for each row execute function public.validar_actualizacion_miembro_grupo();

-- RLS permite actualizar membresías únicamente a administradores activos del grupo.
drop policy if exists miembros_grupo_update_admin on public.miembros_grupo;
create policy miembros_grupo_update_admin on public.miembros_grupo
for update to authenticated
using (public.usuario_es_admin_grupo(grupo_id))
with check (public.usuario_es_admin_grupo(grupo_id));

-- Sincroniza perfiles.rol y evita que un usuario quitado conserve el grupo como contexto activo.
create or replace function public.sincronizar_perfil_miembro_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  alternativa public.miembros_grupo%rowtype;
  nuevo_grupo_id uuid;
  email_usuario text;
begin
  if new.estado = 'activo' and new.rol is distinct from old.rol then
    perform set_config('spendwise.cambiando_grupo_activo', '1', true);
    update public.perfiles set rol = new.rol, actualizado_en = now()
    where id = new.usuario_id and grupo_id = new.grupo_id;
  end if;

  if old.estado = 'activo' and new.estado = 'inactivo'
    and exists (select 1 from public.perfiles where id = new.usuario_id and grupo_id = new.grupo_id) then
    select * into alternativa
    from public.miembros_grupo
    where usuario_id = new.usuario_id and estado = 'activo' and grupo_id <> new.grupo_id
    order by creado_en
    limit 1;

    if alternativa.id is null then
      select coalesce(email, new.email, 'usuario') into email_usuario from public.perfiles where id = new.usuario_id;
      insert into public.grupos (nombre) values ('Grupo de ' || split_part(email_usuario, '@', 1)) returning id into nuevo_grupo_id;
      insert into public.miembros_grupo (grupo_id, usuario_id, email, rol, estado)
      values (nuevo_grupo_id, new.usuario_id, email_usuario, 'admin', 'activo')
      returning * into alternativa;
    end if;

    perform set_config('spendwise.cambiando_grupo_activo', '1', true);
    update public.perfiles
    set grupo_id = alternativa.grupo_id, rol = alternativa.rol, actualizado_en = now()
    where id = new.usuario_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_sincronizar_perfil_miembro_grupo on public.miembros_grupo;
create trigger trigger_sincronizar_perfil_miembro_grupo
after update on public.miembros_grupo
for each row execute function public.sincronizar_perfil_miembro_grupo();

create or replace function public.cambiar_rol_miembro_grupo(miembro_id uuid, nuevo_rol text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  miembro public.miembros_grupo%rowtype;
begin
  if nuevo_rol not in ('admin', 'miembro') then
    raise exception 'Rol de grupo inválido.';
  end if;

  select * into miembro from public.miembros_grupo where id = miembro_id for update;
  if miembro.id is null or not public.usuario_es_admin_grupo(miembro.grupo_id) then
    raise exception 'No tenés permisos para administrar este grupo.';
  end if;
  if miembro.estado <> 'activo' then
    raise exception 'Solo se puede cambiar el rol de un miembro activo.';
  end if;

  -- Bloquea las membresías del grupo para serializar promociones, bajas y demociones concurrentes.
  perform 1 from public.miembros_grupo where grupo_id = miembro.grupo_id for update;
  update public.miembros_grupo set rol = nuevo_rol where id = miembro.id;

end;
$$;

create or replace function public.quitar_miembro_grupo(miembro_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  miembro public.miembros_grupo%rowtype;
begin
  select * into miembro from public.miembros_grupo where id = miembro_id for update;
  if miembro.id is null or not public.usuario_es_admin_grupo(miembro.grupo_id) then
    raise exception 'No tenés permisos para administrar este grupo.';
  end if;
  if miembro.estado <> 'activo' then return; end if;

  perform 1 from public.miembros_grupo where grupo_id = miembro.grupo_id for update;
  update public.miembros_grupo set estado = 'inactivo' where id = miembro.id;

end;
$$;

revoke all on function public.cambiar_rol_miembro_grupo(uuid, text) from public;
revoke all on function public.quitar_miembro_grupo(uuid) from public;
grant execute on function public.cambiar_rol_miembro_grupo(uuid, text) to authenticated;
grant execute on function public.quitar_miembro_grupo(uuid) to authenticated;

-- La pantalla Grupo lista miembros activos e inactivos si el usuario pertenece activamente al grupo.
drop policy if exists miembros_grupo_select_propias on public.miembros_grupo;
drop policy if exists miembros_grupo_select_grupos_propios on public.miembros_grupo;
create policy miembros_grupo_select_grupos_propios on public.miembros_grupo
for select to authenticated
using (public.usuario_tiene_membresia_activa(grupo_id));

-- Invitaciones: integrantes del grupo pueden verlas; solo admin crea/cancela y el destinatario acepta.
drop policy if exists invitaciones_select_grupo on public.invitaciones_grupo;
create policy invitaciones_select_grupo on public.invitaciones_grupo
for select to authenticated
using (
  public.usuario_tiene_membresia_activa(grupo_id)
  or lower(email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
);
