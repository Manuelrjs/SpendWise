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
