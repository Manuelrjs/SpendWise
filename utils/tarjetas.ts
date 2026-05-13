export type FechaEntrada = string | Date;

export interface CalendarioTarjeta {
  id: string;
  cuenta_tarjeta_id: string;
  periodo_resumen: string;
  fecha_cierre: FechaEntrada;
  fecha_vencimiento: FechaEntrada;
  estado_calendario: string;
  origen_fecha: string;
  observaciones?: string | null;
}

export interface ResultadoPeriodoTarjeta {
  periodo_resumen: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  periodo_pago: string;
  calendario_id: string;
  estado_calendario: string;
  origen_fecha: string;
  es_estimado: boolean;
  advertencia: string | null;
}

export function normalizarFecha(fecha: FechaEntrada): Date {
  if (fecha instanceof Date) {
    if (Number.isNaN(fecha.getTime())) {
      throw new Error('Fecha inválida: se recibió un objeto Date inválido.');
    }

    return new Date(fecha.getTime());
  }

  if (typeof fecha !== 'string' || fecha.trim().length === 0) {
    throw new Error('Fecha inválida: se esperaba un string no vacío o un Date.');
  }

  const fechaLimpia = fecha.trim();
  const soloFecha = /^\d{4}-\d{2}-\d{2}$/;
  const fechaNormalizada = soloFecha.test(fechaLimpia)
    ? `${fechaLimpia}T00:00:00.000Z`
    : fechaLimpia;

  const fechaConvertida = new Date(fechaNormalizada);

  if (Number.isNaN(fechaConvertida.getTime())) {
    throw new Error(`Fecha inválida: "${fecha}" no se pudo convertir.`);
  }

  return fechaConvertida;
}

export function formatearPeriodoDesdeFecha(fecha: FechaEntrada): string {
  const fechaNormalizada = normalizarFecha(fecha);
  const anio = fechaNormalizada.getUTCFullYear();
  const mes = String(fechaNormalizada.getUTCMonth() + 1).padStart(2, '0');

  return `${anio}-${mes}`;
}

export function ordenarCalendariosPorCierre(
  calendarios: CalendarioTarjeta[],
): CalendarioTarjeta[] {
  return [...calendarios].sort((a, b) => {
    const fechaA = normalizarFecha(a.fecha_cierre).getTime();
    const fechaB = normalizarFecha(b.fecha_cierre).getTime();

    return fechaA - fechaB;
  });
}

function formatearFechaISO(fecha: FechaEntrada): string {
  const fechaNormalizada = normalizarFecha(fecha);
  return fechaNormalizada.toISOString().slice(0, 10);
}

export function calcularPeriodoTarjeta(params: {
  fecha_gasto: FechaEntrada;
  cuenta_tarjeta_id: string;
  calendarios: CalendarioTarjeta[];
}): ResultadoPeriodoTarjeta {
  const { fecha_gasto, cuenta_tarjeta_id, calendarios } = params;

  if (!cuenta_tarjeta_id || cuenta_tarjeta_id.trim().length === 0) {
    throw new Error('cuenta_tarjeta_id es obligatorio para calcular el período de tarjeta.');
  }

  if (!Array.isArray(calendarios) || calendarios.length === 0) {
    throw new Error(
      `No hay calendarios disponibles para la cuenta ${cuenta_tarjeta_id}. Cargá cierres y vencimientos antes de registrar el gasto.`,
    );
  }

  const fechaGasto = normalizarFecha(fecha_gasto);
  const calendariosDeCuenta = calendarios.filter(
    (calendario) => calendario.cuenta_tarjeta_id === cuenta_tarjeta_id,
  );

  if (calendariosDeCuenta.length === 0) {
    throw new Error(
      `No hay calendarios para la cuenta ${cuenta_tarjeta_id} en los datos recibidos.`,
    );
  }

  const calendariosOrdenados = ordenarCalendariosPorCierre(calendariosDeCuenta);
  const calendarioSeleccionado = calendariosOrdenados.find((calendario) => {
    const fechaCierre = normalizarFecha(calendario.fecha_cierre);
    return fechaCierre.getTime() >= fechaGasto.getTime();
  });

  if (!calendarioSeleccionado) {
    const ultimoCalendario = calendariosOrdenados[calendariosOrdenados.length - 1];
    const ultimoCierre = formatearFechaISO(ultimoCalendario.fecha_cierre);
    const fechaGastoIso = formatearFechaISO(fechaGasto);

    throw new Error(
      `Falta calendario futuro para la cuenta ${cuenta_tarjeta_id}: la fecha del gasto (${fechaGastoIso}) es posterior al último cierre cargado (${ultimoCierre}).`,
    );
  }

  const esEstimado = calendarioSeleccionado.estado_calendario !== 'confirmado';

  return {
    periodo_resumen: calendarioSeleccionado.periodo_resumen,
    fecha_cierre: formatearFechaISO(calendarioSeleccionado.fecha_cierre),
    fecha_vencimiento: formatearFechaISO(calendarioSeleccionado.fecha_vencimiento),
    periodo_pago: formatearPeriodoDesdeFecha(calendarioSeleccionado.fecha_vencimiento),
    calendario_id: calendarioSeleccionado.id,
    estado_calendario: calendarioSeleccionado.estado_calendario,
    origen_fecha: calendarioSeleccionado.origen_fecha,
    es_estimado: esEstimado,
    advertencia: esEstimado
      ? 'Se usó un calendario no confirmado; verificar cierre y vencimiento.'
      : null,
  };
}

/*
Ejemplos de uso rápido:

const calendarios = [
  {
    id: 'cal-1',
    cuenta_tarjeta_id: 'cta-1',
    periodo_resumen: '2026-01',
    fecha_cierre: '2026-01-29',
    fecha_vencimiento: '2026-02-06',
    estado_calendario: 'confirmado',
    origen_fecha: 'manual',
    observaciones: null,
  },
  {
    id: 'cal-2',
    cuenta_tarjeta_id: 'cta-1',
    periodo_resumen: '2026-02',
    fecha_cierre: '2026-02-27',
    fecha_vencimiento: '2026-03-06',
    estado_calendario: 'confirmado',
    origen_fecha: 'manual',
    observaciones: null,
  },
  {
    id: 'cal-3',
    cuenta_tarjeta_id: 'cta-1',
    periodo_resumen: '2026-03',
    fecha_cierre: '2026-03-31',
    fecha_vencimiento: '2026-04-10',
    estado_calendario: 'estimado',
    origen_fecha: 'estimado_habitual',
    observaciones: 'Pendiente confirmación del banco',
  },
];

calcularPeriodoTarjeta({ fecha_gasto: '2026-01-28', cuenta_tarjeta_id: 'cta-1', calendarios });
// => periodo_resumen: '2026-01', periodo_pago: '2026-02'

calcularPeriodoTarjeta({ fecha_gasto: '2026-01-30', cuenta_tarjeta_id: 'cta-1', calendarios });
// => periodo_resumen: '2026-02', periodo_pago: '2026-03'

calcularPeriodoTarjeta({ fecha_gasto: '2026-03-31', cuenta_tarjeta_id: 'cta-1', calendarios });
// => periodo_resumen: '2026-03', periodo_pago: '2026-04', es_estimado: true
*/
