-- Corrección urgente: asegurar grupo_id en tablas operativas + índices + backfill de desarrollo.

alter table public.personas add column if not exists grupo_id uuid references public.grupos(id);
alter table public.categorias add column if not exists grupo_id uuid references public.grupos(id);
alter table public.medios_pago add column if not exists grupo_id uuid references public.grupos(id);
alter table public.cuentas_tarjeta add column if not exists grupo_id uuid references public.grupos(id);
alter table public.tarjetas_fisicas add column if not exists grupo_id uuid references public.grupos(id);
alter table public.gastos add column if not exists grupo_id uuid references public.grupos(id);
alter table public.cuotas_tarjeta add column if not exists grupo_id uuid references public.grupos(id);
alter table public.calendario_tarjetas add column if not exists grupo_id uuid references public.grupos(id);
alter table public.compras_cuotas_iniciales add column if not exists grupo_id uuid references public.grupos(id);
alter table public.comprobantes add column if not exists grupo_id uuid references public.grupos(id);

create index if not exists personas_grupo_id_idx on public.personas (grupo_id);
create index if not exists categorias_grupo_id_idx on public.categorias (grupo_id);
create index if not exists medios_pago_grupo_id_idx on public.medios_pago (grupo_id);
create index if not exists cuentas_tarjeta_grupo_id_idx on public.cuentas_tarjeta (grupo_id);
create index if not exists tarjetas_fisicas_grupo_id_idx on public.tarjetas_fisicas (grupo_id);
create index if not exists gastos_grupo_id_idx on public.gastos (grupo_id);
create index if not exists cuotas_tarjeta_grupo_id_idx on public.cuotas_tarjeta (grupo_id);
create index if not exists calendario_tarjetas_grupo_id_idx on public.calendario_tarjetas (grupo_id);
create index if not exists compras_cuotas_iniciales_grupo_id_idx on public.compras_cuotas_iniciales (grupo_id);
create index if not exists comprobantes_grupo_id_idx on public.comprobantes (grupo_id);

-- Backfill de desarrollo (solo datos históricos).
-- Usa el grupo más antiguo existente y solo completa filas con grupo_id nulo.
with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.personas
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.categorias
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.medios_pago
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.cuentas_tarjeta
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.tarjetas_fisicas
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.gastos
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.cuotas_tarjeta
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.calendario_tarjetas
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.compras_cuotas_iniciales
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);

with grupo_default as (
  select id from public.grupos order by creado_en asc limit 1
)
update public.comprobantes
set grupo_id = (select id from grupo_default)
where grupo_id is null
  and exists (select 1 from grupo_default);
