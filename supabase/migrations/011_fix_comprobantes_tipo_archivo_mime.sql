-- Corrección segura de tipo_archivo: esta columna guarda el MIME type real.
-- No borra datos, columnas o constraints y no modifica RLS.
-- Solo corrige filas cuyo MIME puede inferirse con certeza desde metadata existente.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'comprobantes'
      and column_name = 'tipo_archivo'
  ) then
    execute $sql$
      update public.comprobantes
      set tipo_archivo = case
        when lower(coalesce(nombre_archivo, '')) like '%.pdf' then 'application/pdf'
        when lower(coalesce(nombre_archivo, '')) like '%.png' then 'image/png'
        when lower(coalesce(nombre_archivo, '')) like '%.webp' then 'image/webp'
        when lower(coalesce(nombre_archivo, '')) like '%.jpg'
          or lower(coalesce(nombre_archivo, '')) like '%.jpeg' then 'image/jpeg'
        when tipo_archivo = 'pdf' then 'application/pdf'
        when tipo_archivo = 'imagen' and lower(coalesce(nombre_archivo, '')) like '%.png' then 'image/png'
        when tipo_archivo = 'imagen' and lower(coalesce(nombre_archivo, '')) like '%.webp' then 'image/webp'
        when tipo_archivo = 'imagen' and (
          lower(coalesce(nombre_archivo, '')) like '%.jpg'
          or lower(coalesce(nombre_archivo, '')) like '%.jpeg'
        ) then 'image/jpeg'
        else tipo_archivo
      end
      where tipo_archivo is null
         or tipo_archivo not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')
    $sql$;
  end if;
end $$;
