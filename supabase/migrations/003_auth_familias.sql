-- Tarea 28: Auth + separación por familia
create extension if not exists pgcrypto;

create table if not exists public.familias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  familia_id uuid not null references public.familias(id) on delete restrict,
  nombre text,
  email text,
  rol text not null default 'admin',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create or replace function public.actualizar_actualizado_en()
returns trigger language plpgsql as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trigger_familias_actualizado_en on public.familias;
create trigger trigger_familias_actualizado_en before update on public.familias
for each row execute function public.actualizar_actualizado_en();

drop trigger if exists trigger_perfiles_actualizado_en on public.perfiles;
create trigger trigger_perfiles_actualizado_en before update on public.perfiles
for each row execute function public.actualizar_actualizado_en();

create or replace function public.crear_familia_y_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  familia_nueva_id uuid;
  email_usuario text;
begin
  email_usuario := coalesce(new.email, 'usuario');
  insert into public.familias(nombre) values ('Familia de ' || email_usuario) returning id into familia_nueva_id;
  insert into public.perfiles(id, familia_id, nombre, email, rol)
  values (new.id, familia_nueva_id, coalesce(new.raw_user_meta_data->>'nombre', split_part(email_usuario, '@', 1)), email_usuario, 'admin')
  on conflict (id) do update set familia_id = excluded.familia_id, email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_spendwise on auth.users;
create trigger on_auth_user_created_spendwise
after insert on auth.users
for each row execute procedure public.crear_familia_y_perfil_nuevo_usuario();

alter table if exists public.personas add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.categorias add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.medios_pago add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.cuentas_tarjeta add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.tarjetas_fisicas add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.gastos add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.cuotas_tarjeta add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.calendario_tarjetas add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.compras_cuotas_iniciales add column if not exists familia_id uuid references public.familias(id);
alter table if exists public.comprobantes add column if not exists familia_id uuid references public.familias(id);

create index if not exists idx_personas_familia_id on public.personas(familia_id);
create index if not exists idx_categorias_familia_id on public.categorias(familia_id);
create index if not exists idx_medios_pago_familia_id on public.medios_pago(familia_id);
create index if not exists idx_cuentas_tarjeta_familia_id on public.cuentas_tarjeta(familia_id);
create index if not exists idx_tarjetas_fisicas_familia_id on public.tarjetas_fisicas(familia_id);
create index if not exists idx_gastos_familia_id on public.gastos(familia_id);
create index if not exists idx_cuotas_tarjeta_familia_id on public.cuotas_tarjeta(familia_id);
create index if not exists idx_calendario_tarjetas_familia_id on public.calendario_tarjetas(familia_id);
create index if not exists idx_compras_cuotas_iniciales_familia_id on public.compras_cuotas_iniciales(familia_id);
create index if not exists idx_comprobantes_familia_id on public.comprobantes(familia_id);

-- fallback para datos existentes: crear familia técnica y asignar filas sin familia
insert into public.familias(nombre)
select 'Familia inicial migración'
where not exists (select 1 from public.familias where nombre = 'Familia inicial migración');

with fam as (
  select id from public.familias where nombre = 'Familia inicial migración' limit 1
)
update public.personas set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.categorias set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.medios_pago set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.cuentas_tarjeta set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.tarjetas_fisicas set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.gastos set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.cuotas_tarjeta set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.calendario_tarjetas set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.compras_cuotas_iniciales set familia_id = (select id from fam) where familia_id is null;
with fam as (select id from public.familias where nombre = 'Familia inicial migración' limit 1)
update public.comprobantes set familia_id = (select id from fam) where familia_id is null;

alter table public.personas alter column familia_id set not null;
alter table public.categorias alter column familia_id set not null;
alter table public.medios_pago alter column familia_id set not null;
alter table public.cuentas_tarjeta alter column familia_id set not null;
alter table public.tarjetas_fisicas alter column familia_id set not null;
alter table public.gastos alter column familia_id set not null;
alter table public.cuotas_tarjeta alter column familia_id set not null;
alter table public.calendario_tarjetas alter column familia_id set not null;
alter table public.compras_cuotas_iniciales alter column familia_id set not null;
alter table public.comprobantes alter column familia_id set not null;

alter table public.familias enable row level security;
alter table public.perfiles enable row level security;

create or replace function public.familia_id_usuario_actual()
returns uuid language sql stable as $$
  select familia_id from public.perfiles where id = auth.uid() limit 1;
$$;

create policy "perfiles_select_propios" on public.perfiles for select using (id = auth.uid());
create policy "perfiles_update_propios" on public.perfiles for update using (id = auth.uid());
create policy "familias_select_por_perfil" on public.familias for select using (id = public.familia_id_usuario_actual());

create or replace function public.asignar_familia_id_por_sesion()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.familia_id is null then
    new.familia_id := public.familia_id_usuario_actual();
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_personas_asignar_familia on public.personas;
create trigger trigger_personas_asignar_familia before insert on public.personas for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_categorias_asignar_familia on public.categorias;
create trigger trigger_categorias_asignar_familia before insert on public.categorias for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_medios_pago_asignar_familia on public.medios_pago;
create trigger trigger_medios_pago_asignar_familia before insert on public.medios_pago for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_cuentas_tarjeta_asignar_familia on public.cuentas_tarjeta;
create trigger trigger_cuentas_tarjeta_asignar_familia before insert on public.cuentas_tarjeta for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_tarjetas_fisicas_asignar_familia on public.tarjetas_fisicas;
create trigger trigger_tarjetas_fisicas_asignar_familia before insert on public.tarjetas_fisicas for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_gastos_asignar_familia on public.gastos;
create trigger trigger_gastos_asignar_familia before insert on public.gastos for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_cuotas_tarjeta_asignar_familia on public.cuotas_tarjeta;
create trigger trigger_cuotas_tarjeta_asignar_familia before insert on public.cuotas_tarjeta for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_calendario_tarjetas_asignar_familia on public.calendario_tarjetas;
create trigger trigger_calendario_tarjetas_asignar_familia before insert on public.calendario_tarjetas for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_compras_cuotas_iniciales_asignar_familia on public.compras_cuotas_iniciales;
create trigger trigger_compras_cuotas_iniciales_asignar_familia before insert on public.compras_cuotas_iniciales for each row execute function public.asignar_familia_id_por_sesion();
drop trigger if exists trigger_comprobantes_asignar_familia on public.comprobantes;
create trigger trigger_comprobantes_asignar_familia before insert on public.comprobantes for each row execute function public.asignar_familia_id_por_sesion();
