# SpendWise

SpendWise es una aplicación web responsive para control de gastos familiares, tarjetas de crédito, cuotas y flujo mensual de pagos.

## Objetivo

Reemplazar y mejorar el flujo actual basado en Telegram + n8n + Google Sheets.

El sistema debe permitir:

- Registrar gastos rápidamente.
- Buscar gastos mejor que en Telegram.
- Identificar persona que gastó.
- Identificar medio de pago.
- Identificar cuenta de tarjeta.
- Identificar tarjeta física o adicional.
- Generar cuotas futuras.
- Cargar cuotas pendientes iniciales.
- Calcular flujo mensual de pagos de tarjetas.
- Más adelante adjuntar comprobantes, registrar pagos parciales, intereses, OCR e IA para conciliación.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Vercel futuro

## Fases

### Fase 1

MVP funcional:

- Personas
- Categorías
- Medios de pago
- Cuentas de tarjeta
- Tarjetas físicas/adicionales
- Calendario de cierres y vencimientos
- Registro de gastos
- Cuotas
- Carga inicial de cuotas
- Flujo mensual
- Historial
- Dashboard

### Fase 1.5

Comprobantes:

- Foto
- PDF
- Supabase Storage

### Fase 2

Pagos parciales, saldos e intereses.

### Fase 3

Importaciones masivas.

### Fase 4

Conciliación manual.

### Fase 5

OCR de facturas.

### Fase 6

IA para conciliación automática.

## Configuración de Supabase (Tarea 2)

1. Crear un proyecto en Supabase.
2. Copiar `.env.example` a `.env.local`.
3. Completar las variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

4. Reiniciar el servidor de desarrollo (`npm run dev`).

### Archivos preparados

- `lib/supabase/client.ts`: cliente Supabase para componentes cliente.
- `lib/supabase/server.ts`: fábrica de cliente Supabase para uso en servidor.

> Nota: En esta tarea solo se deja la conexión base lista. No se implementa Auth, RLS ni tablas.

## Validaciones manuales

- Validación manual de cálculo de período de tarjeta: `node --experimental-strip-types scripts/probar-calculo-periodo.ts`.

## Fase 1.5 — Comprobantes (Tarea 17)

1. Ejecutar la migración `supabase/migrations/002_comprobantes.sql` en tu proyecto de Supabase.
2. Verificar que exista el bucket de Storage llamado `comprobantes` (crear uno público o con políticas de lectura según tu entorno).
3. En esta fase los comprobantes (imagen/PDF) se guardan en Supabase Storage y se registra su metadata en la tabla `comprobantes`.
4. El archivado histórico hacia Google Drive queda pendiente para una fase posterior (no implementado en Fase 1.5).

## Extracción automática de comprobantes (imágenes)

La pantalla **/gastos/nuevo** permite analizar comprobantes con OpenAI Vision para sugerir datos antes de guardar.

### Configuración

1. Agregar la API key en `.env.local`:

```bash
OPENAI_API_KEY=
# opcional: OPENAI_VISION_MODEL=gpt-4o-mini
```

2. Reiniciar el servidor (`npm run dev`).

### Alcance actual

- Solo se procesan imágenes (`jpg`, `jpeg`, `png`, `webp`).
- PDF todavía no se procesa y muestra: **"La lectura automática de PDF se implementará en una fase posterior."**
- El análisis se ejecuta **server-side** en `POST /api/comprobantes/analizar`.
- La API key debe quedar del lado servidor y **nunca** en variables `NEXT_PUBLIC`.

### Comportamiento funcional

- La IA devuelve sugerencias de: fecha, establecimiento, monto total, moneda, categoría sugerida, medio de pago sugerido, identificador fiscal, descripción, observaciones, confianza y advertencias.
- El usuario puede **Aplicar sugerencias** o **Descartar sugerencias**.
- El usuario siempre valida antes de guardar.
- El gasto **no** se guarda automáticamente al analizar el comprobante.
- Si falta `OPENAI_API_KEY`, la app muestra: **"La extracción automática aún no está configurada."**


## Instalar SpendWise en iPhone como PWA

1. Abrir la URL de SpendWise en **Safari**.
2. Tocar el botón **Compartir**.
3. Elegir **Agregar a pantalla de inicio**.
4. Confirmar el nombre **SpendWise**.
5. Abrir la app desde el ícono en la pantalla de inicio.

Notas importantes:

- Esta PWA todavía **no** es una app publicada en App Store.
- El análisis de PDF con IA queda para una fase posterior.
- El share directo desde WhatsApp queda para una fase posterior.

## Cargar comprobantes desde WhatsApp en iPhone

### Flujo recomendado

1. Guardar la imagen del comprobante desde WhatsApp en **Fotos** o **Archivos**.
2. Abrir SpendWise.
3. Ir a **Nuevo gasto**.
4. Tocar **Elegir de galería** o **Subir archivo**.
5. Tocar **Analizar comprobante** para obtener sugerencias.

### Flujo experimental (PWA Share Target)

1. Compartir imagen/PDF desde WhatsApp o Fotos hacia **SpendWise** (si aparece como opción).
2. SpendWise abre **/gastos/nuevo** con el comprobante precargado para revisión manual.

Notas:

- En iPhone, las PWA pueden no aparecer como destino directo en el menú Compartir.
- El soporte de compartir directo depende de iOS/Safari y de si la PWA está instalada.
- Si SpendWise no aparece en el menú de compartir, usar el flujo recomendado de galería/archivos.
- Los PDF simples ya pueden analizarse con IA en /gastos/nuevo. Para resúmenes de tarjeta, la conciliación queda para una fase posterior.

## Análisis de comprobantes PDF

- En **/gastos/nuevo** se soporta el análisis con IA de **PDF simples** de comprobantes/facturas (digitales o escaneados de una o pocas páginas).
- Si el archivo parece un **resumen de tarjeta**, la app muestra una advertencia y aclara que la conciliación de resúmenes se implementará en una fase posterior.
- Si el PDF no se puede analizar con la configuración actual, se muestra un mensaje claro y se puede continuar con la **carga manual** del gasto.
- El análisis se ejecuta del lado servidor en `/api/comprobantes/analizar`.

## Auth básica con grupos/perfiles (corrección urgente)

1. Ir a **Supabase → SQL Editor**.
2. Ejecutar el SQL de `supabase/migrations/004_auth_grupos_perfiles.sql`.
3. Verificar que existan las tablas `grupos` y `perfiles`.
4. En Supabase Auth habilitar Email/Password.
5. Crear primer usuario desde `/registro` o desde panel Auth.
6. Si el usuario no tiene perfil, la app intenta repararlo con `ensureUserProfile` creando primero un `grupo` y luego el `perfil`.
7. La API key `OPENAI_API_KEY` sigue siendo server-side y no debe exponerse en variables `NEXT_PUBLIC`.

### Probar login

- Ir a `/login` con un usuario válido.
- Si no hay sesión, las rutas privadas redirigen a `/login`.
- Cerrar sesión desde menú lateral y verificar vuelta a `/login`.

## Autenticación en desarrollo

### Confirmación de email en Supabase

- Si en Supabase Auth está activa la confirmación de email, el registro puede crear el usuario **sin iniciar sesión inmediata**.
- En ese caso, SpendWise muestra: **"Cuenta creada. Revisá tu correo para confirmar el acceso."**
- Hasta confirmar el correo, el login puede devolver el error de email no confirmado.

### Desarrollo local rápido

- Para pruebas internas, podés desactivar la confirmación de email en Supabase Auth.
- Con confirmación desactivada, al registrarte la sesión se crea al instante y la app redirige al dashboard.

### Cómo probar login y registro

1. Ir a `/registro` y crear un usuario nuevo.
2. Si hay sesión inmediata, validar redirección al dashboard.
3. Cerrar sesión y volver a `/login`.
4. Iniciar sesión con el mismo usuario y confirmar acceso.
5. Probar contraseña incorrecta y verificar que el botón vuelva a habilitarse y se vea el error.

### Si no se crea perfil/grupo automáticamente

- SpendWise intenta reparar el perfil en cada login/sesión con `ensureUserProfile`.
- Si el usuario existe en Auth pero no tiene perfil o grupo, la app crea los datos faltantes.
- Si falla la reparación, se muestra un mensaje claro para reintentar sesión y revisar logs de cliente.

## Asociación de datos por grupo

Desde la Tarea 29, los datos operativos se separan por `grupo_id` para evitar mezcla entre grupos.

Tablas operativas con `grupo_id`:

- `personas`
- `categorias`
- `medios_pago`
- `cuentas_tarjeta`
- `tarjetas_fisicas`
- `gastos`
- `cuotas_tarjeta`
- `calendario_tarjetas`
- `compras_cuotas_iniciales`
- `comprobantes`

### Corrección urgente de columnas faltantes

1. Ir a **Supabase → SQL Editor**.
2. Abrir el archivo `supabase/migrations/007_fix_grupo_id_operational_tables.sql`.
3. Ejecutar **todo** el contenido SQL de la migración.
4. Confirmar que cada tabla operativa listada tenga la columna `grupo_id`.
5. Confirmar que los datos existentes con `grupo_id` nulo hayan sido asignados al grupo default (el grupo más antiguo por `creado_en`).
6. Probar el Dashboard.

### Verificación sugerida en Supabase

- En **Table Editor**, abrir cada tabla operativa y verificar la presencia de `grupo_id`.
- En **SQL Editor**, validar backfill con consultas como:

```sql
select count(*) as pendientes_sin_grupo from public.gastos where grupo_id is null;
select count(*) as pendientes_sin_grupo from public.cuotas_tarjeta where grupo_id is null;
select count(*) as pendientes_sin_grupo from public.calendario_tarjetas where grupo_id is null;
```

Si los conteos dan `0`, el backfill quedó aplicado para esas tablas.

> Importante: este backfill es solo para datos históricos de desarrollo. No debe moverse a `ensureUserProfile` ni ejecutarse en cada login.

## Seguridad por grupo con RLS

Desde la Tarea 30, SpendWise protege las tablas operativas con **Row Level Security (RLS)** en Supabase usando `grupo_id`.

### Activar RLS en Supabase

1. Abrir el archivo `supabase/migrations/008_enable_rls_operational_tables.sql`.
2. Copiar todo el contenido del archivo.
3. Ir a **Supabase → SQL Editor → New query**.
4. Pegar el SQL completo.
5. Presionar **Run**.
6. Verificar en **Table Editor** que las tablas operativas ya no aparezcan como **UNRESTRICTED**.

### Pruebas esperadas después de ejecutar la migración

1. Usuario 1 sigue viendo sus datos.
2. Usuario 2 no ve datos del Usuario 1.
3. Usuario 2 puede crear sus propios datos.
4. Usuario 1 no ve datos del Usuario 2.

### Cómo funciona

- El frontend mantiene los filtros explícitos por grupo activo, por ejemplo `.eq('grupo_id', perfil.grupo_id)`, para que las pantallas sigan mostrando solo el contexto actual.
- Supabase también valida en base de datos que el usuario autenticado solo pueda operar filas cuyo `grupo_id` coincida con el `grupo_id` de su registro en `perfiles`.
- Las políticas permiten `SELECT`, `INSERT` y `UPDATE` únicamente dentro del grupo del usuario.
- No se habilita `DELETE` general para datos operativos porque la app usa anulación lógica (`estado_registro = 'anulado'`, `estado = 'cancelada'/'anulada'` o `activo = false`, según corresponda).
- La única excepción es `calendario_tarjetas`, donde se permite `DELETE` solo dentro del grupo del usuario para eliminar períodos sin uso o consolidar duplicados.

### Tablas protegidas

- `personas`
- `categorias`
- `medios_pago`
- `cuentas_tarjeta`
- `tarjetas_fisicas`
- `gastos`
- `cuotas_tarjeta`
- `calendario_tarjetas`
- `compras_cuotas_iniciales`
- `comprobantes`

### Datos con `grupo_id` nulo

Las filas operativas con `grupo_id` nulo no cumplen ninguna política RLS y no serán visibles para usuarios autenticados. Antes de activar esta migración en un ambiente con datos reales, validar y corregir esos casos con un backfill controlado.

## Storage de comprobantes

Desde la Tarea 31, los comprobantes nuevos se guardan en el bucket de Supabase Storage **`comprobantes`** usando una ruta interna separada por grupo:

```text
{grupo_id}/{año}/{mes}/{gasto_id}/{timestamp}-{uuid}-{nombre_archivo_sanitizado}
```

Vista como ruta completa del bucket:

```text
comprobantes/{grupo_id}/{año}/{mes}/{gasto_id}/{archivo}
```

Ejemplo:

```text
comprobantes/7b8f0000-0000-0000-0000-000000000000/2026/06/gasto-uuid/1780000000000-uuid-factura.pdf
```

### Metadata guardada

La tabla `comprobantes` guarda la metadata del archivo asociado al gasto, incluyendo:

- `grupo_id`: tomado del perfil activo del usuario.
- `gasto_id`: gasto al que pertenece el archivo.
- `nombre_archivo`: nombre original visible para el usuario.
- `tipo_archivo` y `mime_type`: MIME del archivo (`image/jpeg`, `image/png`, `image/webp` o `application/pdf`).
- `storage_path`: ruta interna exacta dentro del bucket `comprobantes` (sin prefijar nuevamente el nombre del bucket).
- `ruta_storage`: columna histórica que puede existir en ambientes anteriores para compatibilidad de lectura.
- `tamaño_bytes`: tamaño del archivo cuando el navegador lo informa.
- `creado_en`: timestamp generado por la base.


### Corrección urgente de metadata de comprobantes

Después de esta corrección, ejecutar en Supabase SQL Editor la migración:

```sql
supabase/migrations/010_fix_comprobantes_storage_metadata.sql
```

Esta migración no borra datos. Agrega columnas faltantes en `public.comprobantes`, backfillea metadata posible desde columnas históricas y asegura políticas RLS por `grupo_id` para `SELECT`, `INSERT` y `UPDATE`.

Verificar en Supabase Table Editor que `comprobantes` tenga estas columnas:

- `grupo_id`
- `storage_path`
- `mime_type`
- `nombre_archivo`
- `tipo_archivo`
- `tamaño_bytes`

Para comprobantes nuevos, el `storage_path` guardado debe verse así:

```text
{grupo_id}/{año}/{mes}/{gasto_id}/{archivo}
```

No debe guardarse como `comprobantes/comprobantes/...` ni incluir dos veces el nombre del bucket.

### Bucket privado y signed URLs

El bucket **debe ser privado**. La app ya no guarda URLs públicas permanentes para comprobantes nuevos. Para previsualizar o descargar un comprobante, el cliente genera una **signed URL temporal** contra la ruta guardada en la metadata y solo después de consultar `comprobantes` filtrando por `grupo_id`.

Los comprobantes históricos no se migran en esta tarea. Si un comprobante viejo tiene `grupo_id` en metadata pero usa una ruta anterior, la app intenta mantener compatibilidad; en desarrollo muestra una advertencia en consola si la ruta no incluye el `grupo_id` esperado.

### Políticas de Storage

Ejecutar la migración:

```sql
supabase/migrations/009_storage_comprobantes_por_grupo.sql
```

La migración:

1. Asegura columnas de metadata compatibles iniciales (`grupo_id`, `mime_type`, `storage_path`, `tamano_bytes`). La corrección posterior `010_fix_comprobantes_storage_metadata.sql` agrega además `tamaño_bytes`.
2. Crea o actualiza el bucket `comprobantes` como privado (`public = false`).
3. Crea políticas sobre `storage.objects` para `SELECT`, `INSERT`, `UPDATE` y `DELETE` limitadas al grupo del usuario.

Para el bucket `comprobantes`, Supabase guarda el objeto con `storage.objects.name` sin el nombre del bucket. Por eso la política valida que el primer segmento de `name` coincida con el grupo del perfil:

```sql
p.grupo_id::text = (storage.foldername(name))[1]
```

### Cómo probar con dos usuarios

1. Iniciar sesión con **Usuario 1** y crear/subir un comprobante a un gasto.
2. Verificar en Storage que el archivo quedó en `comprobantes/{grupo_id_usuario_1}/AAAA/MM/{gasto_id}/...`.
3. Verificar en la tabla `comprobantes` que `grupo_id` coincide con el grupo del Usuario 1 y que `storage_path` empieza con ese `grupo_id`.
4. Abrir historial de gastos y confirmar que el Usuario 1 ve el badge **“Con comprobante · PDF”** o **“Con comprobante · Imagen”** y puede abrir la preview/descarga.
5. Cerrar sesión e iniciar con **Usuario 2**.
6. Confirmar que Usuario 2 no ve el comprobante del Usuario 1 en `/gastos`.
7. Intentar abrir con Usuario 2 una ruta/signed URL generada por Usuario 1 después de vencida o generar acceso directo desde metadata ajena: debe fallar por RLS/políticas de Storage.
8. Subir un comprobante propio con Usuario 2 y confirmar que queda bajo `comprobantes/{grupo_id_usuario_2}/...`.
9. Volver con Usuario 1 y confirmar que no ve el comprobante del Usuario 2.
