-- Corrección urgente: las invitaciones reciben el token generado por la aplicación.
-- No borra invitaciones existentes ni modifica las políticas RLS.

alter table public.invitaciones_grupo
alter column token drop default;

create or replace function public.preparar_invitacion_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email_invitado := lower(trim(new.email_invitado));

  -- La aplicación debe enviar un token seguro; este trigger nunca lo genera ni lo reemplaza.
  if new.token is null or length(new.token) < 32 then
    raise exception 'La invitación requiere un token seguro generado por la aplicación.';
  end if;

  new.invitado_por := auth.uid();
  return new;
end;
$$;

-- Diagnóstico posterior a la migración: column_default debe devolver NULL.
-- select
--   column_name,
--   column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'invitaciones_grupo'
--   and column_name = 'token';
