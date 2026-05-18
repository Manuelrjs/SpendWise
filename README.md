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
