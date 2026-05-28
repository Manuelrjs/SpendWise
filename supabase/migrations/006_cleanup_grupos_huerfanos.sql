-- Limpieza segura: elimina solo grupos huérfanos sin perfiles ni datos operativos
create or replace function public.eliminar_grupos_huerfanos_sin_datos()
returns table(grupo_id uuid, nombre text)
language plpgsql
as $$
begin
  return query
  with grupos_huerfanos as (
    select g.id, g.nombre
    from public.grupos g
    left join public.perfiles p on p.grupo_id = g.id
    where p.id is null
  ), grupos_con_datos as (
    select distinct grupo_id from public.personas where grupo_id is not null
    union select distinct grupo_id from public.categorias where grupo_id is not null
    union select distinct grupo_id from public.medios_pago where grupo_id is not null
    union select distinct grupo_id from public.cuentas_tarjeta where grupo_id is not null
    union select distinct grupo_id from public.tarjetas_fisicas where grupo_id is not null
    union select distinct grupo_id from public.gastos where grupo_id is not null
    union select distinct grupo_id from public.cuotas_tarjeta where grupo_id is not null
    union select distinct grupo_id from public.calendario_tarjetas where grupo_id is not null
    union select distinct grupo_id from public.compras_cuotas_iniciales where grupo_id is not null
    union select distinct grupo_id from public.comprobantes where grupo_id is not null
  ), grupos_a_borrar as (
    select gh.id, gh.nombre
    from grupos_huerfanos gh
    left join grupos_con_datos gd on gd.grupo_id = gh.id
    where gd.grupo_id is null
  ), borrados as (
    delete from public.grupos g
    using grupos_a_borrar gb
    where g.id = gb.id
    returning g.id, g.nombre
  )
  select b.id, b.nombre from borrados b;
end;
$$;
