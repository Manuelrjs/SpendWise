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

## Invitar usuarios al grupo

La pantalla **Grupo** (`/configuracion/grupo`) permite que un usuario con rol `admin` invite a otra persona a compartir el grupo activo.

1. El administrador ingresa el email del destinatario, elige el rol inicial (`miembro` o `admin`) y presiona **Invitar**.
2. SpendWise crea una invitación pendiente con un token aleatorio seguro y muestra el botón **Copiar link**. Por ahora el enlace se comparte manualmente por WhatsApp, email u otro medio; no hay envío automático.
3. El destinatario abre `/aceptar-invitacion?token=...`. Si no inició sesión, debe ingresar o registrarse con el mismo email al que llegó la invitación y luego volverá automáticamente al enlace.
4. Al aceptar, su `perfiles.grupo_id` y su rol cambian al grupo invitante. La invitación queda aceptada y deja de estar disponible.

Por ahora, cada usuario puede pertenecer a **un solo grupo**. Si ya tenía un grupo propio, sus datos anteriores no se mueven ni se borran automáticamente; simplemente deja de verlos al cambiar su grupo activo. El soporte multi-grupo queda para una fase posterior.

### Migración de invitaciones

Ejecutar `supabase/migrations/012_invitaciones_grupo.sql` en Supabase SQL Editor. La migración crea `invitaciones_grupo`, sus índices, validaciones, triggers y políticas RLS. También permite listar perfiles del mismo grupo y evita que un usuario cambie su propio `grupo_id` o rol sin una invitación válida.


### Validación manual de invitaciones

1. Iniciar como **Usuario 1 admin**, crear una invitación para Usuario 2 y comprobar que aparece pendiente con un link copiable.
2. Abrir el link sin sesión y comprobar que ofrece iniciar sesión o crear una cuenta, conservando el token para volver después de autenticar.
3. Iniciar como **Usuario 2** con el email invitado, aceptar y comprobar que su perfil cambia al grupo de Usuario 1, la invitación queda aceptada y puede ver los datos compartidos.
4. Abrir el link con un usuario de email diferente y comprobar el mensaje **“Esta invitación pertenece a otro email.”**.
5. Iniciar como usuario `miembro` y comprobar que no aparece el formulario para invitar y que RLS rechaza un `INSERT` manual.
6. Como admin, cancelar una invitación pendiente y comprobar que el link muestra **“Esta invitación ya no está disponible.”**.
