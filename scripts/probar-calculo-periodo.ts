import { calcularPeriodoTarjeta, type CalendarioTarjeta } from '../utils/tarjetas.ts';

interface CasoPrueba {
  descripcion: string;
  fecha_gasto: string;
  esperado?: {
    periodo_resumen: string;
    periodo_pago: string;
  };
  esperaError?: boolean;
  textoErrorEsperado?: string;
}

const cuentaTarjetaId = 'cta-1';

const calendariosSimulados: CalendarioTarjeta[] = [
  {
    id: 'cal-2026-01',
    cuenta_tarjeta_id: cuentaTarjetaId,
    periodo_resumen: '2026-01',
    fecha_cierre: '2026-01-29',
    fecha_vencimiento: '2026-02-06',
    estado_calendario: 'confirmado',
    origen_fecha: 'manual',
    observaciones: null,
  },
  {
    id: 'cal-2026-02',
    cuenta_tarjeta_id: cuentaTarjetaId,
    periodo_resumen: '2026-02',
    fecha_cierre: '2026-02-27',
    fecha_vencimiento: '2026-03-06',
    estado_calendario: 'confirmado',
    origen_fecha: 'manual',
    observaciones: null,
  },
  {
    id: 'cal-2026-03',
    cuenta_tarjeta_id: cuentaTarjetaId,
    periodo_resumen: '2026-03',
    fecha_cierre: '2026-03-31',
    fecha_vencimiento: '2026-04-10',
    estado_calendario: 'confirmado',
    origen_fecha: 'manual',
    observaciones: null,
  },
];

const casos: CasoPrueba[] = [
  {
    descripcion: 'Caso 1: gasto 2026-01-28',
    fecha_gasto: '2026-01-28',
    esperado: { periodo_resumen: '2026-01', periodo_pago: '2026-02' },
  },
  {
    descripcion: 'Caso 2: gasto 2026-01-30',
    fecha_gasto: '2026-01-30',
    esperado: { periodo_resumen: '2026-02', periodo_pago: '2026-03' },
  },
  {
    descripcion: 'Caso 3: gasto 2026-03-31',
    fecha_gasto: '2026-03-31',
    esperado: { periodo_resumen: '2026-03', periodo_pago: '2026-04' },
  },
  {
    descripcion: 'Caso 4: gasto 2026-04-01 (sin calendario futuro)',
    fecha_gasto: '2026-04-01',
    esperaError: true,
    textoErrorEsperado: 'Falta calendario futuro',
  },
];

function ejecutarPrueba(caso: CasoPrueba): boolean {
  try {
    const resultado = calcularPeriodoTarjeta({
      fecha_gasto: caso.fecha_gasto,
      cuenta_tarjeta_id: cuentaTarjetaId,
      calendarios: calendariosSimulados,
    });

    if (caso.esperaError) {
      console.log(`❌ ${caso.descripcion}`);
      console.log(
        `   Se esperaba error, pero devolvió periodo_resumen=${resultado.periodo_resumen}, periodo_pago=${resultado.periodo_pago}`,
      );
      return false;
    }

    const coincidePeriodoResumen = resultado.periodo_resumen === caso.esperado?.periodo_resumen;
    const coincidePeriodoPago = resultado.periodo_pago === caso.esperado?.periodo_pago;

    if (coincidePeriodoResumen && coincidePeriodoPago) {
      console.log(`✅ ${caso.descripcion}`);
      console.log(
        `   periodo_resumen=${resultado.periodo_resumen}, periodo_pago=${resultado.periodo_pago}`,
      );
      return true;
    }

    console.log(`❌ ${caso.descripcion}`);
    console.log(
      `   Esperado: periodo_resumen=${caso.esperado?.periodo_resumen}, periodo_pago=${caso.esperado?.periodo_pago}`,
    );
    console.log(
      `   Recibido: periodo_resumen=${resultado.periodo_resumen}, periodo_pago=${resultado.periodo_pago}`,
    );
    return false;
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);

    if (caso.esperaError) {
      const coincideError = caso.textoErrorEsperado
        ? mensaje.includes(caso.textoErrorEsperado)
        : true;

      if (coincideError) {
        console.log(`✅ ${caso.descripcion}`);
        console.log(`   Error controlado: ${mensaje}`);
        return true;
      }

      console.log(`❌ ${caso.descripcion}`);
      console.log(`   Error inesperado: ${mensaje}`);
      return false;
    }

    console.log(`❌ ${caso.descripcion}`);
    console.log(`   Error inesperado: ${mensaje}`);
    return false;
  }
}

console.log('Validación manual de calcularPeriodoTarjeta con calendarios simulados');

const aprobados = casos.reduce((acumulado, caso) => acumulado + (ejecutarPrueba(caso) ? 1 : 0), 0);

console.log(`\nResultado final: ${aprobados}/${casos.length} casos aprobados.`);

if (aprobados !== casos.length) {
  process.exitCode = 1;
}
