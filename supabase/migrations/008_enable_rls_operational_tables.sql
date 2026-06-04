-- Activar RLS por grupo_id en tablas operativas de SpendWise.
-- No modifica las políticas de grupos ni perfiles.
-- Cada política valida que el usuario autenticado tenga un perfil en el mismo grupo_id de la fila.

alter table public.personas enable row level security;
alter table public.categorias enable row level security;
alter table public.medios_pago enable row level security;
alter table public.cuentas_tarjeta enable row level security;
alter table public.tarjetas_fisicas enable row level security;
alter table public.gastos enable row level security;
alter table public.cuotas_tarjeta enable row level security;
alter table public.calendario_tarjetas enable row level security;
alter table public.compras_cuotas_iniciales enable row level security;
alter table public.comprobantes enable row level security;

-- Personas
drop policy if exists "personas_select_by_group" on public.personas;
drop policy if exists "personas_insert_by_group" on public.personas;
drop policy if exists "personas_update_by_group" on public.personas;
drop policy if exists "personas_delete_by_group" on public.personas;
drop policy if exists personas_select_por_grupo on public.personas;
drop policy if exists personas_insert_por_grupo on public.personas;
drop policy if exists personas_update_por_grupo on public.personas;
drop policy if exists personas_delete_por_grupo on public.personas;

create policy "personas_select_by_group"
on public.personas
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = personas.grupo_id
  )
);

create policy "personas_insert_by_group"
on public.personas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = personas.grupo_id
  )
);

create policy "personas_update_by_group"
on public.personas
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = personas.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = personas.grupo_id
  )
);

-- Categorías
drop policy if exists "categorias_select_by_group" on public.categorias;
drop policy if exists "categorias_insert_by_group" on public.categorias;
drop policy if exists "categorias_update_by_group" on public.categorias;
drop policy if exists "categorias_delete_by_group" on public.categorias;
drop policy if exists categorias_select_por_grupo on public.categorias;
drop policy if exists categorias_insert_por_grupo on public.categorias;
drop policy if exists categorias_update_por_grupo on public.categorias;
drop policy if exists categorias_delete_por_grupo on public.categorias;

create policy "categorias_select_by_group"
on public.categorias
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = categorias.grupo_id
  )
);

create policy "categorias_insert_by_group"
on public.categorias
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = categorias.grupo_id
  )
);

create policy "categorias_update_by_group"
on public.categorias
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = categorias.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = categorias.grupo_id
  )
);

-- Medios de pago
drop policy if exists "medios_pago_select_by_group" on public.medios_pago;
drop policy if exists "medios_pago_insert_by_group" on public.medios_pago;
drop policy if exists "medios_pago_update_by_group" on public.medios_pago;
drop policy if exists "medios_pago_delete_by_group" on public.medios_pago;
drop policy if exists medios_pago_select_por_grupo on public.medios_pago;
drop policy if exists medios_pago_insert_por_grupo on public.medios_pago;
drop policy if exists medios_pago_update_por_grupo on public.medios_pago;
drop policy if exists medios_pago_delete_por_grupo on public.medios_pago;

create policy "medios_pago_select_by_group"
on public.medios_pago
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = medios_pago.grupo_id
  )
);

create policy "medios_pago_insert_by_group"
on public.medios_pago
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = medios_pago.grupo_id
  )
);

create policy "medios_pago_update_by_group"
on public.medios_pago
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = medios_pago.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = medios_pago.grupo_id
  )
);

-- Cuentas de tarjeta
drop policy if exists "cuentas_tarjeta_select_by_group" on public.cuentas_tarjeta;
drop policy if exists "cuentas_tarjeta_insert_by_group" on public.cuentas_tarjeta;
drop policy if exists "cuentas_tarjeta_update_by_group" on public.cuentas_tarjeta;
drop policy if exists "cuentas_tarjeta_delete_by_group" on public.cuentas_tarjeta;
drop policy if exists cuentas_tarjeta_select_por_grupo on public.cuentas_tarjeta;
drop policy if exists cuentas_tarjeta_insert_por_grupo on public.cuentas_tarjeta;
drop policy if exists cuentas_tarjeta_update_por_grupo on public.cuentas_tarjeta;
drop policy if exists cuentas_tarjeta_delete_por_grupo on public.cuentas_tarjeta;

create policy "cuentas_tarjeta_select_by_group"
on public.cuentas_tarjeta
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuentas_tarjeta.grupo_id
  )
);

create policy "cuentas_tarjeta_insert_by_group"
on public.cuentas_tarjeta
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuentas_tarjeta.grupo_id
  )
);

create policy "cuentas_tarjeta_update_by_group"
on public.cuentas_tarjeta
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuentas_tarjeta.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuentas_tarjeta.grupo_id
  )
);

-- Tarjetas físicas
drop policy if exists "tarjetas_fisicas_select_by_group" on public.tarjetas_fisicas;
drop policy if exists "tarjetas_fisicas_insert_by_group" on public.tarjetas_fisicas;
drop policy if exists "tarjetas_fisicas_update_by_group" on public.tarjetas_fisicas;
drop policy if exists "tarjetas_fisicas_delete_by_group" on public.tarjetas_fisicas;
drop policy if exists tarjetas_fisicas_select_por_grupo on public.tarjetas_fisicas;
drop policy if exists tarjetas_fisicas_insert_por_grupo on public.tarjetas_fisicas;
drop policy if exists tarjetas_fisicas_update_por_grupo on public.tarjetas_fisicas;
drop policy if exists tarjetas_fisicas_delete_por_grupo on public.tarjetas_fisicas;

create policy "tarjetas_fisicas_select_by_group"
on public.tarjetas_fisicas
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = tarjetas_fisicas.grupo_id
  )
);

create policy "tarjetas_fisicas_insert_by_group"
on public.tarjetas_fisicas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = tarjetas_fisicas.grupo_id
  )
);

create policy "tarjetas_fisicas_update_by_group"
on public.tarjetas_fisicas
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = tarjetas_fisicas.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = tarjetas_fisicas.grupo_id
  )
);

-- Gastos
drop policy if exists "gastos_select_by_group" on public.gastos;
drop policy if exists "gastos_insert_by_group" on public.gastos;
drop policy if exists "gastos_update_by_group" on public.gastos;
drop policy if exists "gastos_delete_by_group" on public.gastos;
drop policy if exists gastos_select_por_grupo on public.gastos;
drop policy if exists gastos_insert_por_grupo on public.gastos;
drop policy if exists gastos_update_por_grupo on public.gastos;
drop policy if exists gastos_delete_por_grupo on public.gastos;

create policy "gastos_select_by_group"
on public.gastos
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = gastos.grupo_id
  )
);

create policy "gastos_insert_by_group"
on public.gastos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = gastos.grupo_id
  )
);

create policy "gastos_update_by_group"
on public.gastos
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = gastos.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = gastos.grupo_id
  )
);

-- Cuotas de tarjeta
drop policy if exists "cuotas_tarjeta_select_by_group" on public.cuotas_tarjeta;
drop policy if exists "cuotas_tarjeta_insert_by_group" on public.cuotas_tarjeta;
drop policy if exists "cuotas_tarjeta_update_by_group" on public.cuotas_tarjeta;
drop policy if exists "cuotas_tarjeta_delete_by_group" on public.cuotas_tarjeta;
drop policy if exists cuotas_tarjeta_select_por_grupo on public.cuotas_tarjeta;
drop policy if exists cuotas_tarjeta_insert_por_grupo on public.cuotas_tarjeta;
drop policy if exists cuotas_tarjeta_update_por_grupo on public.cuotas_tarjeta;
drop policy if exists cuotas_tarjeta_delete_por_grupo on public.cuotas_tarjeta;

create policy "cuotas_tarjeta_select_by_group"
on public.cuotas_tarjeta
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuotas_tarjeta.grupo_id
  )
);

create policy "cuotas_tarjeta_insert_by_group"
on public.cuotas_tarjeta
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuotas_tarjeta.grupo_id
  )
);

create policy "cuotas_tarjeta_update_by_group"
on public.cuotas_tarjeta
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuotas_tarjeta.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = cuotas_tarjeta.grupo_id
  )
);

-- Calendario de tarjetas
drop policy if exists "calendario_tarjetas_select_by_group" on public.calendario_tarjetas;
drop policy if exists "calendario_tarjetas_insert_by_group" on public.calendario_tarjetas;
drop policy if exists "calendario_tarjetas_update_by_group" on public.calendario_tarjetas;
drop policy if exists "calendario_tarjetas_delete_by_group" on public.calendario_tarjetas;
drop policy if exists calendario_tarjetas_select_por_grupo on public.calendario_tarjetas;
drop policy if exists calendario_tarjetas_insert_por_grupo on public.calendario_tarjetas;
drop policy if exists calendario_tarjetas_update_por_grupo on public.calendario_tarjetas;
drop policy if exists calendario_tarjetas_delete_por_grupo on public.calendario_tarjetas;

create policy "calendario_tarjetas_select_by_group"
on public.calendario_tarjetas
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = calendario_tarjetas.grupo_id
  )
);

create policy "calendario_tarjetas_insert_by_group"
on public.calendario_tarjetas
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = calendario_tarjetas.grupo_id
  )
);

create policy "calendario_tarjetas_update_by_group"
on public.calendario_tarjetas
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = calendario_tarjetas.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = calendario_tarjetas.grupo_id
  )
);

-- Único DELETE operativo permitido: calendarios sin uso, siempre dentro del grupo del usuario.
create policy "calendario_tarjetas_delete_by_group"
on public.calendario_tarjetas
for delete
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = calendario_tarjetas.grupo_id
  )
);

-- Compras/cuotas iniciales
drop policy if exists "compras_cuotas_iniciales_select_by_group" on public.compras_cuotas_iniciales;
drop policy if exists "compras_cuotas_iniciales_insert_by_group" on public.compras_cuotas_iniciales;
drop policy if exists "compras_cuotas_iniciales_update_by_group" on public.compras_cuotas_iniciales;
drop policy if exists "compras_cuotas_iniciales_delete_by_group" on public.compras_cuotas_iniciales;
drop policy if exists compras_cuotas_iniciales_select_por_grupo on public.compras_cuotas_iniciales;
drop policy if exists compras_cuotas_iniciales_insert_por_grupo on public.compras_cuotas_iniciales;
drop policy if exists compras_cuotas_iniciales_update_por_grupo on public.compras_cuotas_iniciales;
drop policy if exists compras_cuotas_iniciales_delete_por_grupo on public.compras_cuotas_iniciales;

create policy "compras_cuotas_iniciales_select_by_group"
on public.compras_cuotas_iniciales
for select
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = compras_cuotas_iniciales.grupo_id
  )
);

create policy "compras_cuotas_iniciales_insert_by_group"
on public.compras_cuotas_iniciales
for insert
to authenticated
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = compras_cuotas_iniciales.grupo_id
  )
);

create policy "compras_cuotas_iniciales_update_by_group"
on public.compras_cuotas_iniciales
for update
to authenticated
using (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = compras_cuotas_iniciales.grupo_id
  )
)
with check (
  exists (
    select 1
    from public.perfiles p
    where p.id = auth.uid()
      and p.grupo_id = compras_cuotas_iniciales.grupo_id
  )
);

-- Comprobantes
drop policy if exists "comprobantes_select_by_group" on public.comprobantes;
drop policy if exists "comprobantes_insert_by_group" on public.comprobantes;
drop policy if exists "comprobantes_update_by_group" on public.comprobantes;
drop policy if exists "comprobantes_delete_by_group" on public.comprobantes;
drop policy if exists comprobantes_select_por_grupo on public.comprobantes;
drop policy if exists comprobantes_insert_por_grupo on public.comprobantes;
drop policy if exists comprobantes_update_por_grupo on public.comprobantes;
drop policy if exists comprobantes_delete_por_grupo on public.comprobantes;

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
