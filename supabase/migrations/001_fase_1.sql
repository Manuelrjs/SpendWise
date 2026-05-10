-- Fase 1: Esquema inicial de ControlFlow
-- Incluye únicamente tablas del MVP.

create extension if not exists pgcrypto;

create table personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text,
  email text,
  relacion_familiar text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint personas_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint personas_email_formato check (email is null or position('@' in email) > 1)
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  icono text,
  color text,
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint categorias_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint categorias_orden_no_negativo check (orden >= 0)
);

create table medios_pago (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  activo boolean not null default true,
  orden integer not null default 0,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint medios_pago_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint medios_pago_tipo_valido check (tipo in ('efectivo', 'debito', 'transferencia', 'tarjeta_credito', 'billetera_virtual', 'otro')),
  constraint medios_pago_orden_no_negativo check (orden >= 0)
);

create table cuentas_tarjeta (
  id uuid primary key default gen_random_uuid(),
  nombre_cuenta text not null,
  banco text,
  marca text,
  persona_titular_id uuid not null references personas(id),
  activo boolean not null default true,
  color_ui text,
  icono_ui text,
  dia_cierre_habitual integer,
  dias_hasta_vencimiento integer,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cuentas_tarjeta_nombre_no_vacio check (btrim(nombre_cuenta) <> ''),
  constraint cuentas_tarjeta_dia_cierre_valido check (dia_cierre_habitual is null or dia_cierre_habitual between 1 and 31),
  constraint cuentas_tarjeta_dias_vencimiento_valido check (dias_hasta_vencimiento is null or dias_hasta_vencimiento >= 0)
);

create table tarjetas_fisicas (
  id uuid primary key default gen_random_uuid(),
  cuenta_tarjeta_id uuid not null references cuentas_tarjeta(id),
  persona_id uuid not null references personas(id),
  tipo text not null,
  nombre_en_tarjeta text,
  alias text,
  ultimos_4_digitos text,
  activo boolean not null default true,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint tarjetas_fisicas_tipo_valido check (tipo in ('titular', 'adicional')),
  constraint tarjetas_fisicas_ultimos_4_digitos_valido check (ultimos_4_digitos is null or ultimos_4_digitos ~ '^[0-9]{4}$')
);

create table calendario_tarjetas (
  id uuid primary key default gen_random_uuid(),
  cuenta_tarjeta_id uuid not null references cuentas_tarjeta(id),
  periodo_resumen text not null,
  fecha_cierre date not null,
  fecha_vencimiento date not null,
  estado_calendario text not null,
  origen_fecha text not null,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint calendario_tarjetas_periodo_formato check (periodo_resumen ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint calendario_tarjetas_estado_valido check (estado_calendario in ('estimado', 'confirmado', 'importado', 'modificado_manual')),
  constraint calendario_tarjetas_origen_valido check (origen_fecha in ('manual', 'calculado', 'importado', 'resumen_banco')),
  constraint calendario_tarjetas_fechas_orden check (fecha_vencimiento >= fecha_cierre)
);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  fecha_gasto date not null,
  establecimiento text,
  categoria_id uuid references categorias(id),
  monto numeric(14,2) not null,
  moneda text not null default 'ARS',
  medio_pago_id uuid not null references medios_pago(id),
  cuenta_tarjeta_id uuid references cuentas_tarjeta(id),
  tarjeta_fisica_id uuid references tarjetas_fisicas(id),
  persona_id uuid not null references personas(id),
  cantidad_cuotas integer not null default 1,
  descripcion text,
  observaciones text,
  origen_registro text not null default 'manual',
  estado_registro text not null default 'confirmado',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint gastos_monto_positivo check (monto > 0),
  constraint gastos_cantidad_cuotas_valida check (cantidad_cuotas >= 1),
  constraint gastos_origen_valido check (origen_registro in ('manual', 'importacion', 'n8n', 'ocr', 'conciliacion')),
  constraint gastos_estado_valido check (estado_registro in ('borrador', 'confirmado', 'anulado'))
);

create table compras_cuotas_iniciales (
  id uuid primary key default gen_random_uuid(),
  fecha_compra_original date,
  establecimiento text,
  descripcion_compra text,
  cuenta_tarjeta_id uuid not null references cuentas_tarjeta(id),
  tarjeta_fisica_id uuid references tarjetas_fisicas(id),
  persona_id uuid not null references personas(id),
  cuota_inicio_pendiente integer not null,
  total_cuotas integer not null,
  monto_cuota numeric(14,2) not null,
  moneda text not null default 'ARS',
  periodo_inicio_pago text not null,
  categoria_id uuid references categorias(id),
  observaciones text,
  estado text not null default 'pendiente',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint compras_cuotas_iniciales_cuota_inicio_valida check (cuota_inicio_pendiente >= 1),
  constraint compras_cuotas_iniciales_total_cuotas_valido check (total_cuotas >= 1),
  constraint compras_cuotas_iniciales_cuota_menor_igual_total check (cuota_inicio_pendiente <= total_cuotas),
  constraint compras_cuotas_iniciales_monto_cuota_positivo check (monto_cuota > 0),
  constraint compras_cuotas_iniciales_periodo_formato check (periodo_inicio_pago ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

create table cuotas_tarjeta (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid references gastos(id),
  compra_cuota_inicial_id uuid references compras_cuotas_iniciales(id),
  cuenta_tarjeta_id uuid not null references cuentas_tarjeta(id),
  tarjeta_fisica_id uuid references tarjetas_fisicas(id),
  persona_id uuid not null references personas(id),
  establecimiento text,
  descripcion_cuota text,
  numero_cuota integer not null,
  total_cuotas integer not null,
  monto_cuota numeric(14,2) not null,
  moneda text not null default 'ARS',
  periodo_pago_estimado text not null,
  periodo_pago_real text,
  fecha_estimada_pago date,
  fecha_real_pago date,
  estado text not null default 'pendiente',
  origen_cuota text not null,
  motivo_modificacion text,
  observaciones text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint cuotas_tarjeta_origen_referencia check (
    (gasto_id is not null and compra_cuota_inicial_id is null)
    or (gasto_id is null and compra_cuota_inicial_id is not null)
  ),
  constraint cuotas_tarjeta_numero_cuota_valido check (numero_cuota >= 1),
  constraint cuotas_tarjeta_total_cuotas_valido check (total_cuotas >= 1),
  constraint cuotas_tarjeta_numero_menor_igual_total check (numero_cuota <= total_cuotas),
  constraint cuotas_tarjeta_monto_cuota_positivo check (monto_cuota > 0),
  constraint cuotas_tarjeta_periodo_estimado_formato check (periodo_pago_estimado ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint cuotas_tarjeta_periodo_real_formato check (periodo_pago_real is null or periodo_pago_real ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  constraint cuotas_tarjeta_estado_valido check (estado in ('pendiente', 'proyectada', 'incluida_resumen', 'no_incluida', 'reprogramada', 'pagada', 'cancelada')),
  constraint cuotas_tarjeta_origen_valido check (origen_cuota in ('gasto_nuevo', 'carga_inicial', 'importacion', 'ajuste_manual', 'conciliacion'))
);
