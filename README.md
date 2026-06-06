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

Los comprobantes nuevos se guardan en el bucket de Supabase Storage **`comprobantes`** con una ruta interna separada por grupo:

```text
{grupo_id}/{año}/{mes}/{gasto_id}/{timestamp}-{uuid}-{nombre_archivo_sanitizado}
```

La ruta que se guarda en la tabla es la ruta interna del bucket, sin prefijar nuevamente el nombre del bucket. Por ejemplo, si el bucket es `comprobantes`, `ruta_storage` debe verse así:

```text
7b8f0000-0000-0000-0000-000000000000/2026/06/gasto-uuid/1780000000000-uuid-factura.pdf
```

No debe guardarse como `comprobantes/{grupo_id}/...` porque `comprobantes` ya es el nombre del bucket.

### Tabla `comprobantes`

La app usa como estructura estándar las columnas reales en español de `public.comprobantes`:

- `grupo_id`: grupo del perfil activo del usuario.
- `gasto_id`: gasto asociado.
- `nombre_archivo`: nombre sanitizado/final del archivo guardado.
- `tipo_archivo`: MIME type real permitido (`image/jpeg`, `image/png`, `image/webp` o `application/pdf`).
- `tipo_comprobante`: clasificación funcional opcional (`imagen`, `pdf` u `otro`); no se usa para decidir la vista previa.
- `ruta_storage`: path interno exacto dentro del bucket `comprobantes`.
- `url_storage`: URL pública solo si el bucket se configura público; con bucket privado puede quedar `NULL`.
- `url_drive`: fallback futuro/histórico si un comprobante está archivado externamente.
- `tamano_bytes`: tamaño informado por el navegador (`file.size`).
- `proveedor_almacenamiento`: proveedor permitido; para archivos nuevos se guarda `supabase`.
- `estado_archivo`: estado permitido; para archivos nuevos se guarda `activo`.
- `creado_en` y `actualizado_en`: timestamps de auditoría.

El código guarda siempre `file.type` en `tipo_archivo`. Las columnas históricas duplicadas como `storage_path`, `mime_type` o `tamaño_bytes` pueden quedar en la base por compatibilidad, pero la app no escribe en ellas.

### Corrección de metadata en Supabase

Para alinear ambientes que hayan recibido migraciones anteriores, ejecutar en Supabase SQL Editor:

```sql
supabase/migrations/011_fix_comprobantes_tipo_archivo_mime.sql
```

La migración no borra datos, archivos, columnas ni constraints, y no modifica RLS. Corrige valores nulos o inconsistentes únicamente cuando puede inferir un MIME permitido desde el nombre del archivo o una clasificación histórica conocida.

### Bucket privado y signed URLs

La estrategia actual es tratar el bucket **`comprobantes`** como privado. Para comprobantes nuevos, `url_storage` queda `NULL` y la app genera una **signed URL temporal** al abrir/descargar usando `ruta_storage`.

Si un ambiente decide hacer público el bucket, `url_storage` puede guardar una URL pública. La pantalla de historial no depende de esa URL: primero intenta usar `ruta_storage` y, si no existe o no se puede firmar, usa `url_storage` o `url_drive` como fallback.

### Compatibilidad con comprobantes antiguos

Pueden existir comprobantes anteriores con rutas viejas tipo:

```text
2026/...
```

y comprobantes nuevos con rutas por grupo:

```text
{grupo_id}/2026/...
```

No se migran ni se borran rutas antiguas en esta tarea. La lectura soporta ambos casos:

1. Si `ruta_storage` existe, la app intenta abrir/descargar desde Storage con ese path.
2. Si `ruta_storage` está `NULL` pero `url_storage` o `url_drive` existe, usa esa URL como fallback.
3. Si no hay ruta ni URL disponible, muestra **“Comprobante no disponible”** sin romper el historial de gastos.

### Políticas de Storage

La migración `supabase/migrations/009_storage_comprobantes_por_grupo.sql` configura el bucket `comprobantes` y políticas de Storage para objetos nuevos bajo `{grupo_id}/...`. Para el bucket `comprobantes`, Supabase guarda `storage.objects.name` sin el nombre del bucket; por eso la política valida que el primer segmento de `name` coincida con el grupo del perfil:

```sql
p.grupo_id::text = (storage.foldername(name))[1]
```

### Cómo probar con imagen, PDF y dos usuarios

1. Iniciar sesión con **Usuario 1** y crear un gasto con una imagen. Verificar que el archivo quede bajo `comprobantes/{grupo_id_usuario_1}/AAAA/MM/{gasto_id}/...` y que la fila de `comprobantes` tenga `grupo_id`, `nombre_archivo`, `tipo_archivo = image/jpeg`, `ruta_storage`, `tamano_bytes`, `proveedor_almacenamiento = supabase` y `estado_archivo = activo`.
2. Crear otro gasto con un PDF. Verificar `tipo_archivo = application/pdf`, `ruta_storage` y `tamano_bytes`.
3. Abrir **Historial de gastos** y confirmar que carga aunque existan comprobantes viejos con metadata incompleta. Los comprobantes con ruta deben abrir/descargar; los que no tengan ruta ni URL deben mostrar **“Comprobante no disponible”**.
4. Cerrar sesión e iniciar con **Usuario 2**. Confirmar que no ve comprobantes del Usuario 1 por las consultas filtradas por `grupo_id` y RLS.
5. Revisar Storage: los comprobantes nuevos deben quedar bajo carpeta `{grupo_id}/...`; las carpetas antiguas `2026/...` pueden seguir existiendo y no se borran.

## Multi-grupo e invitaciones

La pantalla **Grupo** (`/configuracion/grupo`) permite ver el grupo activo, listar las membresías activas y cambiar de grupo. `perfiles.grupo_id` conserva el grupo activo o predeterminado para que las pantallas operativas y sus políticas RLS sigan trabajando con un único contexto. La pertenencia real se guarda en `public.miembros_grupo`.

- Cada pareja `grupo_id` + `usuario_id` es única.
- Una membresía define el rol (`admin` o `miembro`) y el estado (`activo` o `inactivo`) dentro de ese grupo.
- Al cambiar el grupo activo, el RPC `cambiar_grupo_activo` valida que exista una membresía activa, actualiza `perfiles.grupo_id`, sincroniza el rol y recarga el contexto de la app.
- Si el usuario pertenece a un solo grupo, el encabezado muestra su nombre. Si pertenece a varios, muestra el selector **Cambiar grupo**.

### Aceptar una invitación

1. El administrador del grupo activo crea la invitación y comparte manualmente el link; todavía no hay envío automático de email.
2. El destinatario abre `/aceptar-invitacion?token=...`, inicia sesión con el email invitado y acepta.
3. La aceptación crea o reactiva su fila de `miembros_grupo` con el rol indicado y marca la invitación como aceptada.
4. Su `perfiles.grupo_id` **no cambia automáticamente**, por lo que conserva el acceso directo a su grupo anterior. Puede elegir **Cambiar a este grupo ahora** o usar después el selector.
5. Solo un `admin` de la membresía del grupo activo puede crear o cancelar invitaciones.

### Migración multi-grupo

Ejecutar `supabase/migrations/014_multi_grupo_miembros.sql` después de las migraciones de invitaciones. La migración:

- crea `public.miembros_grupo`, índices, restricciones, trigger de actualización y políticas RLS;
- hace backfill de todos los perfiles que tengan `grupo_id`, sin borrar perfiles, grupos, invitaciones ni datos operativos;
- reemplaza la aceptación anterior para crear la membresía sin cambiar el grupo activo;
- agrega los RPC seguros `asegurar_membresia_perfil_actual` y `cambiar_grupo_activo`;
- mantiene `perfiles.grupo_id` como filtro del grupo activo, por lo que no reasigna gastos ni amplía automáticamente las consultas operativas.

### Recuperar un usuario que perdió su grupo activo anterior

Si una aceptación previa dejó a Usuario 1 apuntando al grupo de Usuario 2, crear o reactivar una membresía para **cada uno de los dos grupos**. El grupo original debe conservar el rol que corresponda, normalmente `admin`:

```sql
insert into public.miembros_grupo (grupo_id, usuario_id, email, rol, estado)
values
  ('UUID_GRUPO_ORIGINAL', 'UUID_USUARIO_1', 'usuario1@ejemplo.com', 'admin', 'activo'),
  ('UUID_GRUPO_INVITANTE', 'UUID_USUARIO_1', 'usuario1@ejemplo.com', 'miembro', 'activo')
on conflict (grupo_id, usuario_id) do update
set email = excluded.email, rol = excluded.rol, estado = 'activo', actualizado_en = now();
```

Después, Usuario 1 puede entrar a **Grupo**, seleccionar su grupo original y continuar viendo sus datos. Este procedimiento no mueve ni reasigna gastos.

### Validación manual multi-grupo

1. Iniciar con Usuario 1 y confirmar que el backfill lo dejó como miembro activo/admin de su grupo original.
2. Como Usuario 2 admin, invitar a Usuario 1. Aceptar con Usuario 1 y confirmar que aparece una segunda membresía, pero `perfiles.grupo_id` continúa apuntando al grupo original.
3. Usar el selector para alternar entre ambos grupos y confirmar que todas las pantallas muestran solo los datos del grupo activo.
4. Confirmar que Usuario 2 sigue como admin de su grupo y puede ver sus miembros e invitaciones pendientes.
5. Iniciar como miembro sin rol admin y confirmar que no aparece el formulario de invitación y que RLS rechaza crear o cancelar invitaciones.
