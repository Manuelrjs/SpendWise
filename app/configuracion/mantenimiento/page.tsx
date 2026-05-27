'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';
import { consolidarDuplicadosCalendario, obtenerOCrearCalendarioEstimado, type CalendarioTarjetaDB } from '@/lib/calendario-tarjetas';
import { calcularPeriodoResumenYVencimiento } from '@/utils/tarjetas';

type AnyObj = Record<string, any>;
type DiagnosticoKey =
  | 'gastosSinCompromiso'
  | 'compromisosSinCalendario'
  | 'cargasInicialesARevisar'
  | 'compromisosHuerfanosAnulados'
  | 'duplicadosCalendario'
  | 'calendariosSinUso'
  | 'gastosDuplicados'
  | 'compromisosCancelados';

const ESTADOS_COMPROMISO_ACTIVO = new Set(['pendiente', 'proyectada', 'reprogramada', 'no_incluida']);
const ESTADOS_COMPROMISO_INACTIVO = new Set(['cancelada', 'cancelado', 'anulada', 'anulado']);
const ESTADOS_COMPROMISO_NO_REPARABLE = new Set([...ESTADOS_COMPROMISO_INACTIVO, 'pagada']);

const esGastoAnulado = (estadoRegistro: string | null | undefined) => String(estadoRegistro ?? '').toLowerCase() === 'anulado';
const esGastoActivo = (estadoRegistro: string | null | undefined) => !esGastoAnulado(estadoRegistro);
const esCompromisoActivo = (estado: string | null | undefined) => ESTADOS_COMPROMISO_ACTIVO.has(String(estado ?? '').toLowerCase());
const esEstadoAnuladoOCancelado = (estado: string | null | undefined) => ESTADOS_COMPROMISO_INACTIVO.has(String(estado ?? '').toLowerCase());
const ESTADOS_CARGA_INICIAL_INACTIVA = new Set(['anulado', 'anulada', 'cancelado', 'cancelada']);

const esCargaInicialActiva = (compraInicial: AnyObj | null | undefined, puedeEvaluarEstadoCargaInicial: boolean) => {
  if (!compraInicial) return false;
  if (!puedeEvaluarEstadoCargaInicial) return true;
  const activo = compraInicial.activo;
  if (typeof activo === 'boolean') return activo;
  const estado = String(compraInicial.estado ?? '').toLowerCase();
  if (!estado) return true;
  return !ESTADOS_CARGA_INICIAL_INACTIVA.has(estado);
};
const periodoDesdeFecha = (fecha: string) => fecha.slice(0, 7);

export default function MantenimientoPage() {
  const esDesarrollo = process.env.NODE_ENV !== 'production';
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cardSeleccionada, setCardSeleccionada] = useState<DiagnosticoKey | null>(null);
  const [gastoDetalle, setGastoDetalle] = useState<AnyObj | null>(null);
  const [data, setData] = useState({
    gastosSinCompromiso: [] as AnyObj[],
    compromisosSinCalendario: [] as AnyObj[],
    cargasInicialesARevisar: [] as (AnyObj & { motivo_revision: string })[],
    compromisosHuerfanosAnulados: [] as (AnyObj & { motivo_huerfano: string })[],
    duplicadosCalendario: [] as { key: string; items: CalendarioTarjetaDB[] }[],
    calendariosSinUso: [] as AnyObj[],
    gastosDuplicados: [] as { key: string; items: AnyObj[] }[],
    compromisosCancelados: [] as AnyObj[],
  });
  const [erroresDiagnostico, setErroresDiagnostico] = useState<Partial<Record<DiagnosticoKey, string>>>({});

  const estimarPeriodoResumenYPago = (fecha: string, dia: number | null, dias: number | null) => {
    if (!dia || dias === null) return { periodo_resumen: periodoDesdeFecha(fecha), periodo_pago_estimado: periodoDesdeFecha(fecha), fecha_cierre: null, fecha_vencimiento: null };
    const calculo = calcularPeriodoResumenYVencimiento({ fecha_gasto: fecha, dia_cierre_habitual: dia, dias_hasta_vencimiento: dias });
    return { periodo_resumen: calculo.periodo_resumen, periodo_pago_estimado: calculo.periodo_pago_estimado, fecha_cierre: calculo.fecha_cierre, fecha_vencimiento: calculo.fecha_vencimiento };
  };

  async function diagnosticar() {
    setCargando(true);
    setMensaje('');
    setErroresDiagnostico({});

    const [gastosRes, cuotasRes, calendariosRes, comprasInicialesRes] = await Promise.all([
      supabase
        .from('gastos')
        .select('id,fecha_gasto,establecimiento,monto,moneda,estado_registro,observaciones,creado_en,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,persona:personas(nombre,apellido),categoria:categorias(nombre),cuenta:cuentas_tarjeta(id,nombre_cuenta,dia_cierre_habitual,dias_hasta_vencimiento),tarjeta:tarjetas_fisicas(alias,tipo,ultimos_4_digitos),medio_pago:medios_pago(tipo),comprobante:comprobantes(id)'),
      supabase
        .from('cuotas_tarjeta')
        .select('id,gasto_id,compra_cuota_inicial_id,cuenta_tarjeta_id,periodo_pago_estimado,estado,establecimiento,persona_id,monto_cuota,numero_cuota,total_cuotas,moneda,origen_cuota,fecha_estimada_pago,cuenta:cuentas_tarjeta(id,nombre_cuenta,dia_cierre_habitual,dias_hasta_vencimiento),gasto:gastos(id,fecha_gasto,establecimiento,estado_registro),persona:personas(nombre,apellido),compra_inicial:compras_cuotas_iniciales(id,estado)'),
      supabase
        .from('calendario_tarjetas')
        .select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones,creado_en')
        .order('creado_en', { ascending: true }),
      supabase.from('compras_cuotas_iniciales').select('id,estado,periodo_inicio_pago'),
    ]);

    const erroresBase: Partial<Record<DiagnosticoKey, string>> = {};
    const registrarError = (seccion: DiagnosticoKey, nombreSeccion: string, error: any) => {
      const detalle = error?.message ?? 'Error desconocido';
      erroresBase[seccion] = detalle;
      console.error(`Error diagnóstico - ${nombreSeccion}`, {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        raw: error,
      });
    };

    if (gastosRes.error) registrarError('gastosSinCompromiso', 'gastos de tarjeta sin compromiso', gastosRes.error);
    if (cuotasRes.error) {
      registrarError('compromisosSinCalendario', 'compromisos sin calendario', cuotasRes.error);
      registrarError('cargasInicialesARevisar', 'cargas iniciales a revisar', cuotasRes.error);
      registrarError('compromisosHuerfanosAnulados', 'compromisos huérfanos/anulados', cuotasRes.error);
      registrarError('compromisosCancelados', 'compromisos cancelados/anulados', cuotasRes.error);
    }
    if (calendariosRes.error) {
      registrarError('compromisosSinCalendario', 'compromisos sin calendario', calendariosRes.error);
      registrarError('duplicadosCalendario', 'calendarios duplicados', calendariosRes.error);
      registrarError('calendariosSinUso', 'calendarios sin uso', calendariosRes.error);
    }
    if (comprasInicialesRes.error) registrarError('cargasInicialesARevisar', 'cargas iniciales a revisar', comprasInicialesRes.error);

    const gastos = (gastosRes.data ?? []) as AnyObj[];
    const cuotas = (cuotasRes.data ?? []) as AnyObj[];
    const calendarios = (calendariosRes.data ?? []) as CalendarioTarjetaDB[];
    const comprasIniciales = new Map((comprasInicialesRes.data ?? []).map((c: AnyObj) => [c.id, c]));
    const columnasComprasIniciales = Object.keys((comprasInicialesRes.data?.[0] ?? {}) as AnyObj);
    const tieneColumnaEstadoCargaInicial = columnasComprasIniciales.includes('estado');
    const tieneColumnaActivoCargaInicial = columnasComprasIniciales.includes('activo');
    const puedeEvaluarEstadoCargaInicial = tieneColumnaEstadoCargaInicial || tieneColumnaActivoCargaInicial;
    if ((comprasInicialesRes.data?.length ?? 0) > 0 && !puedeEvaluarEstadoCargaInicial) {
      console.warn('No se encontró columna de estado en compras_cuotas_iniciales; se usará estado de cuotas_tarjeta.');
    }

    const gastosActivos = gastos.filter((g) => esGastoActivo(g.estado_registro));
    const gastosTarjeta = gastosActivos.filter((g) => g.medio_pago?.tipo === 'tarjeta_credito' && g.cuenta_tarjeta_id);
    const gastosPorId = new Map(gastos.map((g) => [g.id, g]));

    const compromisosCancelados: AnyObj[] = [];

    const compromisosHuerfanosAnulados: (AnyObj & { motivo_huerfano: string })[] = [];
    const compromisosSinCalendario: AnyObj[] = [];
    const cargasInicialesARevisar: (AnyObj & { motivo_revision: string })[] = [];
    const safePushSeccion = (seccion: DiagnosticoKey, nombreSeccion: string, fn: () => void) => {
      try {
        fn();
      } catch (error) {
        registrarError(seccion, nombreSeccion, error);
      }
    };

    safePushSeccion('compromisosCancelados', 'compromisos cancelados/anulados', () => {
      compromisosCancelados.push(...cuotas.filter((c) => ESTADOS_COMPROMISO_INACTIVO.has(String(c.estado ?? '').toLowerCase())));
    });
    safePushSeccion('compromisosSinCalendario', 'compromisos sin calendario', () => {
      for (const cuota of cuotas) {
        const estado = String(cuota.estado ?? '').toLowerCase();
        if (ESTADOS_COMPROMISO_NO_REPARABLE.has(estado) || !esCompromisoActivo(estado)) continue;

        if (cuota.origen_cuota === 'gasto_nuevo') {
          if (!cuota.gasto_id) {
            compromisosHuerfanosAnulados.push({ ...cuota, motivo_huerfano: 'Sin gasto asociado' });
            continue;
          }
          const gasto = cuota.gasto ?? gastosPorId.get(cuota.gasto_id);
          if (!gasto) {
            compromisosHuerfanosAnulados.push({ ...cuota, motivo_huerfano: 'Gasto no encontrado' });
            continue;
          }
          if (esGastoAnulado(gasto.estado_registro)) {
            compromisosHuerfanosAnulados.push({ ...cuota, motivo_huerfano: 'Gasto anulado' });
            continue;
          }
          const estimado = estimarPeriodoResumenYPago(gasto.fecha_gasto, cuota.cuenta?.dia_cierre_habitual ?? null, cuota.cuenta?.dias_hasta_vencimiento ?? null);
          const periodoResumenFaltante = estimado.periodo_resumen;
          const tieneCalendario = calendarios.some((cal) => cal.cuenta_tarjeta_id === cuota.cuenta_tarjeta_id && cal.periodo_resumen === periodoResumenFaltante);
          if (!tieneCalendario) {
            compromisosSinCalendario.push({ ...cuota, periodo_resumen_faltante: periodoResumenFaltante, periodo_pago_flujo: estimado.periodo_pago_estimado, origen_visual: 'gasto_nuevo' });
          }
          continue;
        }

        if (cuota.origen_cuota === 'carga_inicial') {
          if (!('compra_cuota_inicial_id' in cuota)) {
            cargasInicialesARevisar.push({ ...cuota, motivo_revision: 'No se encontró referencia directa a la carga inicial.' });
            continue;
          }
          if (!cuota.compra_cuota_inicial_id) {
            cargasInicialesARevisar.push({ ...cuota, motivo_revision: 'No se pudo validar la carga inicial asociada.' });
            continue;
          }
          const compraInicial = cuota.compra_inicial ?? comprasIniciales.get(cuota.compra_cuota_inicial_id);
          if (!compraInicial) {
            cargasInicialesARevisar.push({ ...cuota, motivo_revision: 'No se pudo validar la carga inicial asociada.' });
            continue;
          }
          if (!esCargaInicialActiva(compraInicial, puedeEvaluarEstadoCargaInicial)) {
            compromisosHuerfanosAnulados.push({ ...cuota, motivo_huerfano: 'Carga inicial anulada' });
            continue;
          }
          const periodoResumenExplicito = String(cuota.periodo_resumen ?? compraInicial.periodo_inicio_pago ?? '').slice(0, 7);
          const periodoPago = String(cuota.periodo_pago_estimado ?? '').slice(0, 7);
          const periodoObjetivo = periodoResumenExplicito || periodoPago;
          if (!periodoObjetivo || !/^\d{4}-\d{2}$/.test(periodoObjetivo)) {
            cargasInicialesARevisar.push({ ...cuota, motivo_revision: 'No se pudo inferir período de resumen' });
            continue;
          }
          const tieneCalendario = calendarios.some((cal) => cal.cuenta_tarjeta_id === cuota.cuenta_tarjeta_id && cal.periodo_resumen === periodoObjetivo);
          if (!tieneCalendario) {
            compromisosSinCalendario.push({
              ...cuota,
              periodo_resumen_faltante: periodoObjetivo,
              periodo_pago_flujo: periodoPago || periodoObjetivo,
              origen_visual: 'carga_inicial',
              modo_regeneracion: periodoResumenExplicito ? 'resumen_explicito' : 'periodo_pago',
            });
          }
          continue;
        }
      }
    });
    let gastosSinCompromiso: AnyObj[] = [];
    safePushSeccion('gastosSinCompromiso', 'gastos de tarjeta sin compromiso', () => {
      gastosSinCompromiso = gastosTarjeta.filter((g) => !cuotas.some((c) => c.gasto_id === g.id && !ESTADOS_COMPROMISO_INACTIVO.has(String(c.estado ?? '').toLowerCase())));
    });
    const duplicadosCalendario: { key: string; items: CalendarioTarjetaDB[] }[] = [];
    safePushSeccion('duplicadosCalendario', 'calendarios duplicados', () => {
      const mapaDup = new Map<string, CalendarioTarjetaDB[]>();
      calendarios.forEach((c) => {
        const key = `${c.cuenta_tarjeta_id}::${c.periodo_resumen}`;
        mapaDup.set(key, [...(mapaDup.get(key) ?? []), c]);
      });
      duplicadosCalendario.push(...Array.from(mapaDup.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items })));
    });
    const calendariosSinUso: AnyObj[] = [];
    safePushSeccion('calendariosSinUso', 'calendarios sin uso', () => {
      const keysGasto = new Set(gastosTarjeta.map((g) => `${g.cuenta_tarjeta_id}::${estimarPeriodoResumenYPago(g.fecha_gasto, g.cuenta?.dia_cierre_habitual, g.cuenta?.dias_hasta_vencimiento).periodo_resumen}`));
      const keysCuota = new Set(compromisosSinCalendario.concat(cuotas.filter((c) => esCompromisoActivo(c.estado))).map((c) => `${c.cuenta_tarjeta_id}::${c.periodo_resumen_faltante ?? c.periodo_pago_estimado}`));
      calendariosSinUso.push(...calendarios.filter((c) => !keysGasto.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`) && !keysCuota.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`)));
    });
    const gastosDuplicados: { key: string; items: AnyObj[] }[] = [];
    safePushSeccion('gastosDuplicados', 'gastos duplicados sospechosos', () => {
      const sospechosos = new Map<string, AnyObj[]>();
      gastosTarjeta.forEach((g) => {
        const key = `${g.fecha_gasto}|${(g.establecimiento ?? '').trim().toLowerCase()}|${g.monto}|${g.persona_id}|${g.cuenta_tarjeta_id}`;
        sospechosos.set(key, [...(sospechosos.get(key) ?? []), g]);
      });
      gastosDuplicados.push(...Array.from(sospechosos.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items })));
    });

    const nuevo = { gastosSinCompromiso, compromisosSinCalendario, cargasInicialesARevisar, compromisosHuerfanosAnulados, duplicadosCalendario, calendariosSinUso, gastosDuplicados, compromisosCancelados };
    setErroresDiagnostico(erroresBase);
    setData(nuevo);
    if (cardSeleccionada && (nuevo[cardSeleccionada] as AnyObj[]).length === 0) setCardSeleccionada(null);
    const total = Object.values(nuevo).reduce((acc, v) => acc + v.length, 0);
    const totalErrores = Object.keys(erroresBase).length;
    if (totalErrores > 0) {
      setMensaje(totalErrores >= 8 ? 'No se pudo completar una o más secciones del diagnóstico.' : 'Diagnóstico completado con errores.');
    } else {
      setMensaje(total === 0 ? 'No se detectaron inconsistencias.' : 'Diagnóstico completado.');
    }
    setCargando(false);
  }

  async function marcarCompromisoCancelado(cuota: AnyObj) {
    if (!window.confirm('Este compromiso no tiene un gasto activo asociado. ¿Querés marcarlo como cancelado para excluirlo del flujo y del diagnóstico activo?')) return;
    await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada', actualizado_en: new Date().toISOString() }).eq('id', cuota.id);
    setMensaje('Compromiso marcado como cancelado.');
    await diagnosticar();
  }
  async function abrirDetalleGastoDesdeCuota(cuota: AnyObj) {
    if (!cuota.gasto_id) return;
    const { data: gasto, error } = await supabase
      .from('gastos')
      .select('id,fecha_gasto,establecimiento,monto,moneda,estado_registro,observaciones,persona:personas(nombre,apellido),categoria:categorias(nombre),cuenta:cuentas_tarjeta(nombre_cuenta),tarjeta:tarjetas_fisicas(alias,tipo,ultimos_4_digitos),medio_pago:medios_pago(tipo),comprobante:comprobantes(id)')
      .eq('id', cuota.gasto_id)
      .maybeSingle();
    if (error || !gasto) {
      setMensaje('No se pudo cargar el detalle completo del gasto.');
      return;
    }
    setGastoDetalle(gasto);
  }

  async function abrirDetalleCargaInicialDesdeCuota(cuota: AnyObj) {
    if (!cuota.compra_cuota_inicial_id) return;
    const { data: compra, error } = await supabase.from('compras_cuotas_iniciales').select('id,fecha_compra_original,establecimiento,descripcion_compra,monto_cuota,moneda,cuota_inicio_pendiente,total_cuotas,periodo_inicio_pago,estado,observaciones,persona:personas(nombre,apellido),cuenta:cuentas_tarjeta(nombre_cuenta)').eq('id', cuota.compra_cuota_inicial_id).maybeSingle();
    if (error || !compra) {
      setMensaje('No se pudo cargar el detalle de la carga inicial.');
      return;
    }
    setGastoDetalle({
      tipo_detalle: 'carga_inicial',
      ...compra,
    });
  }

  async function regenerarCalendario(c: AnyObj) {
    if (c.origen_cuota === 'carga_inicial') {
      const periodoResumen = c.periodo_resumen_faltante ?? c.periodo_pago_estimado;
      if (!periodoResumen) {
        setMensaje('No se pudo inferir el período de resumen de esta carga inicial. Revisá la carga inicial manualmente.');
        return;
      }
      await obtenerOCrearCalendarioEstimado({ supabase, cuenta: { id: c.cuenta_tarjeta_id, nombre_cuenta: c.cuenta?.nombre_cuenta, dia_cierre_habitual: c.cuenta?.dia_cierre_habitual ?? null, dias_hasta_vencimiento: c.cuenta?.dias_hasta_vencimiento ?? null }, periodo: periodoResumen, contexto: 'calendario' });
      const observacionCargaInicial = c.modo_regeneracion === 'periodo_pago'
        ? `Calendario regenerado para período de pago de carga inicial (${periodoResumen}).`
        : `Calendario regenerado correctamente para período resumen ${periodoResumen}.`;
      setMensaje(observacionCargaInicial);
      await diagnosticar();
      return;
    }
    if (!c.gasto?.fecha_gasto) {
      setMensaje('No se encontró un gasto activo para regenerar calendario.');
      return;
    }
    const calculo = estimarPeriodoResumenYPago(c.gasto.fecha_gasto, c.cuenta?.dia_cierre_habitual ?? null, c.cuenta?.dias_hasta_vencimiento ?? null);
    await obtenerOCrearCalendarioEstimado({ supabase, cuenta: { id: c.cuenta_tarjeta_id, nombre_cuenta: c.cuenta?.nombre_cuenta, dia_cierre_habitual: c.cuenta?.dia_cierre_habitual ?? null, dias_hasta_vencimiento: c.cuenta?.dias_hasta_vencimiento ?? null }, periodo: calculo.periodo_resumen, contexto: 'calendario' });
    setMensaje(`Calendario regenerado correctamente para período resumen ${calculo.periodo_resumen}.`);
    await diagnosticar();
  }
  async function consolidarGrupo(grupo: { items: CalendarioTarjetaDB[] }) { await consolidarDuplicadosCalendario(supabase, grupo.items); setMensaje('Duplicados consolidados.'); await diagnosticar(); }
  async function repararSeguro() { for (const c of data.compromisosSinCalendario) await regenerarCalendario(c); for (const g of data.duplicadosCalendario) await consolidarGrupo(g); setMensaje('Reparación automática segura finalizada: se regeneraron calendarios faltantes y se consolidaron duplicados claros.'); await diagnosticar(); }

  const cards = useMemo(() => [
    { key: 'gastosSinCompromiso' as const, titulo: 'Gastos de tarjeta sin compromiso', valor: data.gastosSinCompromiso.length, error: erroresDiagnostico.gastosSinCompromiso },
    { key: 'compromisosSinCalendario' as const, titulo: 'Compromisos sin calendario', valor: data.compromisosSinCalendario.length, error: erroresDiagnostico.compromisosSinCalendario },
    { key: 'cargasInicialesARevisar' as const, titulo: 'Cargas iniciales a revisar', valor: data.cargasInicialesARevisar.length, error: erroresDiagnostico.cargasInicialesARevisar },
    { key: 'compromisosHuerfanosAnulados' as const, titulo: 'Compromisos huérfanos/anulados', valor: data.compromisosHuerfanosAnulados.length, error: erroresDiagnostico.compromisosHuerfanosAnulados },
    { key: 'duplicadosCalendario' as const, titulo: 'Calendarios duplicados', valor: data.duplicadosCalendario.length, error: erroresDiagnostico.duplicadosCalendario },
    { key: 'calendariosSinUso' as const, titulo: 'Calendarios sin uso', valor: data.calendariosSinUso.length, error: erroresDiagnostico.calendariosSinUso },
    { key: 'gastosDuplicados' as const, titulo: 'Gastos duplicados sospechosos', valor: data.gastosDuplicados.length, error: erroresDiagnostico.gastosDuplicados },
    { key: 'compromisosCancelados' as const, titulo: 'Compromisos cancelados/anulados', valor: data.compromisosCancelados.length, error: erroresDiagnostico.compromisosCancelados },
  ], [data, erroresDiagnostico]);

  return <main className="space-y-4 p-4 md:p-6">{/* UI abreviada por cambios */}
    <h1 className="text-2xl font-semibold">Mantenimiento</h1>
    <div className="flex flex-wrap gap-2"><button onClick={() => void diagnosticar()} disabled={cargando} className="rounded-lg bg-slate-900 px-4 py-2 text-white">{cargando ? 'Ejecutando...' : 'Ejecutar diagnóstico'}</button><button onClick={() => void repararSeguro()} className="rounded-lg border px-4 py-2">Reparar automáticamente lo seguro</button></div>
    {mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map((c) => <div key={c.key} className={`rounded-xl border bg-white p-4 text-left ${cardSeleccionada === c.key ? 'border-slate-900 ring-1 ring-slate-900' : ''}`}><p className="text-xs text-slate-500">{c.titulo}</p>{c.error ? <><p className="mt-1 text-sm font-semibold text-rose-700">Error al diagnosticar</p><p className="mt-1 text-xs text-slate-600">Ver error abajo.</p><div className="mt-2 flex gap-2">{esDesarrollo && <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void navigator.clipboard.writeText(`Error en ${c.titulo}: ${c.error}`)}>Copiar error</button>}<button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setCardSeleccionada(c.key)}>Ver error</button></div>{cardSeleccionada === c.key && esDesarrollo && <p className="mt-2 break-words rounded bg-rose-50 p-2 text-xs text-rose-800">Error en {c.titulo}: {c.error}</p>}</> : <button onClick={() => c.valor > 0 && setCardSeleccionada(c.key)} className={`${c.valor > 0 ? 'cursor-pointer hover:border-slate-400' : 'cursor-default opacity-80'}`}><p className="text-2xl font-bold">{c.valor}</p></button>}</div>)}</section>
    {cardSeleccionada === 'compromisosSinCalendario' && <section className="space-y-2 rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Estos compromisos activos sí se pueden reparar regenerando calendario de resumen. El período de pago se muestra solo como referencia de flujo.</p>{data.compromisosSinCalendario.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-10 md:gap-2"><span>{c.cuenta?.nombre_cuenta}</span><span>{c.gasto?.fecha_gasto ?? '-'}</span><span>{c.periodo_resumen_faltante ?? '-'}</span><span>{c.periodo_pago_flujo ?? c.periodo_pago_estimado}</span><span>{c.establecimiento}</span><span>{c.monto_cuota}</span><span>{c.persona?.nombre}</span><span>{c.origen_cuota === 'carga_inicial' ? 'Carga inicial' : c.origen_cuota}</span><span>{c.estado}</span><div className="flex gap-2"><button onClick={() => void regenerarCalendario(c)} className="rounded border px-2">Regenerar calendario</button>{c.origen_cuota === 'carga_inicial' ? (c.compra_cuota_inicial_id ? <button className="rounded border px-2" onClick={() => void abrirDetalleCargaInicialDesdeCuota(c)}>Ver carga inicial</button> : <span className="text-xs text-slate-500">Sin referencia de carga inicial</span>) : (c.gasto_id ? <button className="rounded border px-2" onClick={() => void abrirDetalleGastoDesdeCuota(c)}>Ver gasto</button> : <span className="text-xs text-slate-500">Gasto no disponible</span>)}</div></div>)}</section>}
    {cardSeleccionada === 'cargasInicialesARevisar' && <section className="space-y-2 rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Esta carga inicial no tiene un período de resumen claro. Revisá la carga inicial manualmente.</p>{data.cargasInicialesARevisar.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-9 md:gap-2"><span>{c.cuenta?.nombre_cuenta}</span><span>{c.establecimiento}</span><span>{c.monto_cuota}</span><span>{c.persona?.nombre}</span><span>{c.periodo_pago_estimado ?? '-'}</span><span>Carga inicial</span><span>{c.estado}</span><span className="font-medium text-amber-700">{c.motivo_revision}</span><div className="flex gap-2"><button onClick={() => void marcarCompromisoCancelado(c)} className="rounded border px-2">Marcar como cancelado</button>{c.compra_cuota_inicial_id ? <button className="rounded border px-2" onClick={() => void abrirDetalleCargaInicialDesdeCuota(c)}>Ver carga inicial</button> : <span className="text-xs text-slate-500">Sin referencia válida</span>}</div></div>)}</section>}
    {cardSeleccionada === 'compromisosHuerfanosAnulados' && <section className="space-y-2 rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Estos compromisos no tienen un gasto activo asociado. No se regenerará calendario para ellos.</p>{data.compromisosHuerfanosAnulados.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-10 md:gap-2"><span>{c.cuenta?.nombre_cuenta}</span><span>{c.periodo_pago_estimado}</span><span>{c.fecha_estimada_pago ?? '-'}</span><span>{c.establecimiento}</span><span>{c.monto_cuota}</span><span>{c.persona?.nombre}</span><span>{c.origen_cuota === 'carga_inicial' ? 'Carga inicial' : c.origen_cuota}</span><span>{c.estado}</span><span className="font-medium text-amber-700">{c.motivo_huerfano}</span><div className="flex gap-2"><button onClick={() => void marcarCompromisoCancelado(c)} className="rounded border px-2">Marcar como cancelado</button>{c.origen_cuota === 'carga_inicial' ? (c.compra_cuota_inicial_id ? <button className="rounded border px-2" onClick={() => void abrirDetalleCargaInicialDesdeCuota(c)}>Ver carga inicial</button> : <span className="text-xs text-slate-500">Sin referencia de carga inicial</span>) : (c.gasto_id ? <button className="rounded border px-2" onClick={() => void abrirDetalleGastoDesdeCuota(c)}>Ver detalle</button> : <span className="text-xs text-slate-500">Gasto no disponible</span>)}</div></div>)}</section>}
    {gastoDetalle && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-xl rounded-xl bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">{gastoDetalle.tipo_detalle === 'carga_inicial' ? 'Detalle de carga inicial' : 'Detalle de gasto'}</h3><button className="rounded border px-2 py-1 text-sm" onClick={() => setGastoDetalle(null)}>Cerrar</button></div><div className="grid grid-cols-2 gap-2 text-sm"><span>Fecha</span><span>{gastoDetalle.fecha_gasto ?? '-'}</span><span>Establecimiento</span><span>{gastoDetalle.establecimiento ?? '-'}</span><span>Monto</span><span>{gastoDetalle.monto ?? '-'}</span><span>Moneda</span><span>{gastoDetalle.moneda ?? '-'}</span><span>Persona</span><span>{gastoDetalle.persona?.nombre ?? '-'}</span><span>Categoría</span><span>{gastoDetalle.categoria?.nombre ?? '-'}</span><span>Medio de pago</span><span>{gastoDetalle.medio_pago?.tipo ?? '-'}</span><span>Cuenta de tarjeta</span><span>{gastoDetalle.cuenta?.nombre_cuenta ?? '-'}</span><span>Tarjeta física</span><span>{gastoDetalle.tarjeta?.alias ?? '-'}</span><span>Estado</span><span>{gastoDetalle.estado_registro ?? '-'}</span><span>Observaciones</span><span>{gastoDetalle.observaciones ?? '-'}</span><span>Comprobante</span><span>{gastoDetalle.comprobante?.id ? 'Sí' : 'No'}</span></div></div></div>}
  </main>;
}
