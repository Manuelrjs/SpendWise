# SpendFlow Planner — Instrucciones para Codex

## Nombre del proyecto

SpendFlow Planner

## Objetivo

SpendFlow Planner es una aplicación web responsive para control de gastos familiares, tarjetas de crédito, cuotas y flujo mensual de pagos.

El sistema debe permitir registrar gastos de forma rápida, identificar quién gastó, con qué medio de pago, con qué cuenta de tarjeta y con qué tarjeta física/adicional. También debe proyectar cuánto dinero debe reservarse cada mes para pagar tarjetas.

## Stack técnico

- Next.js 14 o superior
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage desde Fase 1.5
- Deploy futuro en Vercel
- App móvil futura con Expo / React Native

## Idioma del proyecto

El usuario habla español como idioma nativo.

Regla obligatoria:

- Nombres de tablas en español.
- Nombres de campos en español.
- Textos visibles de la app en español.
- Comentarios importantes en español.
- `id` puede quedar como `id`.

## Filosofía de desarrollo

No construir todo de una sola vez.

Desarrollar por fases.

### Fase 1 — MVP funcional

Incluye:

- Registro manual de gastos.
- Personas.
- Categorías.
- Medios de pago.
- Cuentas de tarjeta.
- Tarjetas físicas / adicionales.
- Calendario flexible de cierres y vencimientos.
- Compras en cuotas.
- Carga inicial manual de cuotas pendientes.
- Flujo mensual de pagos de tarjetas.
- Historial de gastos con búsqueda y filtros.
- Dashboard básico.

No incluye:

- Comprobantes.
- OCR.
- IA.
- Conciliación automática.
- Pagos parciales.
- Intereses.
- CFT observado.
- App móvil nativa.

### Fase 1.5 — Comprobantes

Incluye:

- Adjuntar foto de ticket/factura.
- Adjuntar PDF.
- Guardar archivo en Supabase Storage.
- Asociar comprobante al gasto.
- Ver comprobante desde detalle de gasto.

No incluye OCR.

### Fase 2 — Pagos parciales, saldos e intereses

Incluye:

- Registrar pago real de resumen de tarjeta.
- Permitir pago parcial.
- Arrastrar saldo financiado.
- Cargar intereses manuales.
- Calcular tasa implícita mensual.
- Calcular tasa efectiva anual aproximada.
- Comparar costo financiero observado por tarjeta.

### Fase 3 — Importaciones masivas

Incluye:

- Importar gastos desde CSV/Excel.
- Importar cuotas pendientes.
- Importar calendario de tarjetas.
- Validar filas antes de guardar.

### Fase 4 — Conciliación manual

Incluye:

- Registrar total real de estado de cuenta.
- Comparar total real vs total proyectado.
- Mover cuotas manualmente.
- Agregar ajustes manuales.

### Fase 5 — OCR de facturas

Incluye:

- Leer factura o PDF.
- Prellenar gasto.
- Usuario valida antes de guardar.

### Fase 6 — IA para conciliación

Incluye:

- Leer PDF de estado de cuenta.
- Extraer movimientos.
- Comparar contra gastos/cuotas.
- Proponer conciliación.
- Usuario valida.

## Modelo conceptual

El sistema debe separar:

- Persona
- Cuenta de tarjeta / estado de cuenta
- Tarjeta física / adicional
- Gasto
- Cuota
- Resumen de tarjeta
- Pago real
- Saldo financiado
- Interés / ajuste

Ejemplo real:

Visa Galicia Manuel:

- Manuel titular
- Paola adicional
- Estado de cuenta llega a nombre de Manuel

Visa Galicia Paola:

- Paola titular
- Suegra adicional
- Estado de cuenta llega a nombre de Paola

Por eso el sistema debe tener:

- cuentas_tarjeta
- tarjetas_fisicas
- personas

No tratar “Visa Galicia” como una sola tarjeta plana.

## Reglas de tarjetas

1. `cuentas_tarjeta` representa el estado de cuenta.
2. `tarjetas_fisicas` representa el plástico usado para gastar.
3. Un gasto con tarjeta debe guardar:
   - cuenta_tarjeta_id
   - tarjeta_fisica_id
   - persona_id

## Reglas de calendario

Los cierres y vencimientos varían mes a mes.

Usar la tabla `calendario_tarjetas` como fuente principal.

Campos:

- cuenta_tarjeta_id
- periodo_resumen
- fecha_cierre
- fecha_vencimiento
- estado_calendario
- origen_fecha

La configuración habitual en `cuentas_tarjeta` solo sirve como respaldo estimado.

## Reglas de cuotas

Si un gasto con tarjeta tiene `cantidad_cuotas = 1`, generar una cuota 1/1.

Si tiene más de una cuota, generar N registros en `cuotas_tarjeta`.

Esto permite que el flujo mensual se calcule siempre desde `cuotas_tarjeta`.

## Carga inicial de cuotas

Cuando el usuario empieza a usar la app, puede tener cuotas anteriores.

No cargar historia completa.

Crear `compras_cuotas_iniciales` y generar cuotas futuras asociadas.

Ejemplo:

Compra Mercado Libre  
Cuota pendiente inicial: 4  
Total cuotas: 6  
Monto cuota: 50.000  
Primer período: 2026-07

Generar:

- 4/6 en 2026-07
- 5/6 en 2026-08
- 6/6 en 2026-09

## UX/UI

Diseño moderno, tipo fintech.

Reglas:

- Mobile-first.
- Debe funcionar bien desde iPhone en Safari.
- No usar formularios largos si se puede evitar.
- Usar cards, botones grandes e iconos.
- Monto debe ser el primer campo.
- Medio de pago debe seleccionarse con botones.
- Tarjetas deben mostrarse como cards.
- Categorías deben mostrarse como botones con iconos.
- Campos avanzados colapsados.
- Recordar últimas selecciones cuando sea posible.

## Flujo de nuevo gasto

Campos principales:

1. Monto
2. Medio de pago
3. Cuenta de tarjeta si aplica
4. Tarjeta física si aplica
5. Establecimiento
6. Categoría
7. Fecha
8. Persona
9. Cuotas si aplica
10. Observaciones opcionales

En Fase 1 no incluir comprobantes.

## Tablas Fase 1

Crear primero:

- personas
- categorias
- medios_pago
- cuentas_tarjeta
- tarjetas_fisicas
- calendario_tarjetas
- gastos
- compras_cuotas_iniciales
- cuotas_tarjeta

No crear tablas futuras hasta que se pidan.

## Reglas para Codex

- Una tarea = una funcionalidad.
- No avanzar a otra fase sin instrucción explícita.
- No implementar OCR ni IA en Fase 1.
- No implementar comprobantes hasta Fase 1.5.
- No implementar pagos parciales hasta Fase 2.
- Mantener nombres en español.
- Usar TypeScript estricto.
- Priorizar código simple, mantenible y claro.
- Si hay ambigüedad, elegir la opción más simple y dejar comentario.
