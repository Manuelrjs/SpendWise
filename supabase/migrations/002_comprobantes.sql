create table if not exists comprobantes (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid not null references gastos(id) on delete cascade,
  tipo_comprobante text,
  tipo_archivo text not null,
  nombre_archivo text,
  ruta_storage text,
  url_storage text,
  url_drive text,
  id_archivo_drive text,
  proveedor_almacenamiento text not null default 'supabase',
  estado_archivo text not null default 'activo',
  fecha_archivado_drive date,
  tamano_bytes integer,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint comprobantes_tipo_archivo_check check (
    tipo_archivo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
  ),
  constraint comprobantes_proveedor_check check (
    proveedor_almacenamiento in ('supabase', 'google_drive', 'supabase_y_drive')
  ),
  constraint comprobantes_estado_check check (
    estado_archivo in ('activo', 'pendiente_archivar', 'archivado_drive', 'error_archivado', 'eliminado_supabase')
  )
);

create index if not exists comprobantes_gasto_id_idx on comprobantes(gasto_id);
