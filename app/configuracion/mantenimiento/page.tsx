'use client';

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { consolidarDuplicadosCalendario, obtenerOCrearCalendarioEstimado, type CalendarioTarjetaDB } from '@/lib/calendario-tarjetas';
import { calcularPeriodoResumenYVencimiento } from '@/utils/tarjetas';

type AnyObj = Record<string, any>;
type DiagnosticoKey =
  | 'gastosSinCompromiso'
  | 'compromisosSinCalendario'
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

export default function MantenimientoPage() {
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cardSeleccionada, setCardSeleccionada] = useState<DiagnosticoKey | null>(null);
  const [gastoDetalle, setGastoDetalle] = useState<AnyObj | null>(null);
  const [data, setData] = useState({
    gastosSinCompromiso: [] as AnyObj[],
    compromisosSinCalendario: [] as AnyObj[],
    compromisosHuerfanosAnulados: [] as (AnyObj & { motivo_huerfano: string })[],
    duplicadosCalendario: [] as { key: string; items: CalendarioTarjetaDB[] }[],
    calendariosSinUso: [] as AnyObj[],
    gastosDuplicados: [] as { key: string; items: AnyObj[] }[],
    compromisosCancelados: [] as AnyObj[],
  });

  const estimarPeriodo = (fecha: string, dia: number | null, dias: number | null) =>
    !dia || dias === null
      ? fecha.slice(0, 7)
      : calcularPeriodoResumenYVencimiento({ fecha_gasto: fecha, dia_cierre_habitual: dia, dias_hasta_vencimiento: dias }).periodo_resumen;

  async function diagnosticar() {
    setCargando(true);
    setMensaje('');
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
      supabase.from('compras_cuotas_iniciales').select('id,estado'),
    ]);

    if (gastosRes.error || cuotasRes.error || calendariosRes.error || comprasInicialesRes.error) {
      setMensaje('No se pudo ejecutar diagnóstico.');
      setCargando(false);
      return;
    }

    const gastos = (gastosRes.data ?? []) as AnyObj[];
    const cuotas = (cuotasRes.data ?? []) as AnyObj[];
    const calendarios = (calendariosRes.data ?? []) as CalendarioTarjetaDB[];
    const comprasIniciales = new Map((comprasInicialesRes.data ?? []).map((c: AnyObj) => [c.id, c]));

    const gastosActivos = gastos.filter((g) => esGastoActivo(g.estado_registro));
    const gastosTarjeta = gastosActivos.filter((g) => g.medio_pago?.tipo === 'tarjeta_credito' && g.cuenta_tarjeta_id);
    const gastosPorId = new Map(gastos.map((g) => [g.id, g]));

    const compromisosCancelados = cuotas.filter((c) => ESTADOS_COMPROMISO_INACTIVO.has(String(c.estado ?? '').toLowerCase()));

    const compromisosHuerfanosAnulados: (AnyObj & { motivo_huerfano: string })[] = [];
    const compromisosSinCalendario: AnyObj[] = [];

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
      }

      if (cuota.origen_cuota === 'carga_inicial') {
        const compraInicial = cuota.compra_inicial ?? (cuota.compra_cuota_inicial_id ? comprasIniciales.get(cuota.compra_cuota_inicial_id) : null);
        if (!cuota.compra_cuota_inicial_id) {
          compromisosHuerfanosAnulados.push({ ...cuota, motivo_huerfano: 'Sin carga inicial asociada' });
          continue;
        }
        if (!compraInicial) {
          compromisosHuerfanosAnulados.push({ ...cuota, motivo_huerfano: 'Carga inicial no encontrada' });
          continue;
        }
        if (ESTADOS_COMPROMISO_INACTIVO.has(String(compraInicial.estado ?? '').toLowerCase())) continue;
      }

      const tieneCalendario = calendarios.some((cal) => cal.cuenta_tarjeta_id === cuota.cuenta_tarjeta_id && cal.periodo_resumen === cuota.periodo_pago_estimado);
      if (!tieneCalendario) compromisosSinCalendario.push(cuota);
    }

    const gastosSinCompromiso = gastosTarjeta.filter((g) => !cuotas.some((c) => c.gasto_id === g.id && !ESTADOS_COMPROMISO_INACTIVO.has(String(c.estado ?? '').toLowerCase())));

    const mapaDup = new Map<string, CalendarioTarjetaDB[]>();
    calendarios.forEach((c) => {
      const key = `${c.cuenta_tarjeta_id}::${c.periodo_resumen}`;
      mapaDup.set(key, [...(mapaDup.get(key) ?? []), c]);
    });
    const duplicadosCalendario = Array.from(mapaDup.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items }));

    const keysGasto = new Set(gastosTarjeta.map((g) => `${g.cuenta_tarjeta_id}::${estimarPeriodo(g.fecha_gasto, g.cuenta?.dia_cierre_habitual, g.cuenta?.dias_hasta_vencimiento)}`));
    const keysCuota = new Set(compromisosSinCalendario.concat(cuotas.filter((c) => esCompromisoActivo(c.estado))).map((c) => `${c.cuenta_tarjeta_id}::${c.periodo_pago_estimado}`));
    const calendariosSinUso = calendarios.filter((c) => !keysGasto.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`) && !keysCuota.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`));

    const sospechosos = new Map<string, AnyObj[]>();
    gastosTarjeta.forEach((g) => {
      const key = `${g.fecha_gasto}|${(g.establecimiento ?? '').trim().toLowerCase()}|${g.monto}|${g.persona_id}|${g.cuenta_tarjeta_id}`;
      sospechosos.set(key, [...(sospechosos.get(key) ?? []), g]);
    });
    const gastosDuplicados = Array.from(sospechosos.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items }));

    const nuevo = { gastosSinCompromiso, compromisosSinCalendario, compromisosHuerfanosAnulados, duplicadosCalendario, calendariosSinUso, gastosDuplicados, compromisosCancelados };
    setData(nuevo);
    if (cardSeleccionada && (nuevo[cardSeleccionada] as AnyObj[]).length === 0) setCardSeleccionada(null);
    const total = Object.values(nuevo).reduce((acc, v) => acc + v.length, 0);
    setMensaje(total === 0 ? 'No se detectaron inconsistencias.' : 'Diagnóstico completado.');
    setCargando(false);
  }

  async function marcarCompromisoCancelado(cuota: AnyObj) {
    if (!window.confirm('Este compromiso no tiene un gasto activo asociado. ¿Querés marcarlo como cancelado para excluirlo del flujo y del diagnóstico activo?')) return;
    await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada', actualizado_en: new Date().toISOString() }).eq('id', cuota.id);
    setMensaje('Compromiso marcado como cancelado.');
    await diagnosticar();
  }
  async function regenerarCalendario(c: AnyObj) { await obtenerOCrearCalendarioEstimado({ supabase, cuenta: { id: c.cuenta_tarjeta_id, nombre_cuenta: c.cuenta?.nombre_cuenta, dia_cierre_habitual: c.cuenta?.dia_cierre_habitual ?? null, dias_hasta_vencimiento: c.cuenta?.dias_hasta_vencimiento ?? null }, periodo: c.periodo_pago_estimado, contexto: 'calendario' }); setMensaje('Calendario regenerado correctamente.'); await diagnosticar(); }
  async function consolidarGrupo(grupo: { items: CalendarioTarjetaDB[] }) { await consolidarDuplicadosCalendario(supabase, grupo.items); setMensaje('Duplicados consolidados.'); await diagnosticar(); }
  async function repararSeguro() { for (const c of data.compromisosSinCalendario) await regenerarCalendario(c); for (const g of data.duplicadosCalendario) await consolidarGrupo(g); setMensaje('Reparación automática segura finalizada: se regeneraron calendarios faltantes y se consolidaron duplicados claros.'); await diagnosticar(); }

  const cards = useMemo(() => [
    { key: 'gastosSinCompromiso' as const, titulo: 'Gastos de tarjeta sin compromiso', valor: data.gastosSinCompromiso.length },
    { key: 'compromisosSinCalendario' as const, titulo: 'Compromisos sin calendario', valor: data.compromisosSinCalendario.length },
    { key: 'compromisosHuerfanosAnulados' as const, titulo: 'Compromisos huérfanos/anulados', valor: data.compromisosHuerfanosAnulados.length },
    { key: 'duplicadosCalendario' as const, titulo: 'Calendarios duplicados', valor: data.duplicadosCalendario.length },
    { key: 'calendariosSinUso' as const, titulo: 'Calendarios sin uso', valor: data.calendariosSinUso.length },
    { key: 'gastosDuplicados' as const, titulo: 'Gastos duplicados sospechosos', valor: data.gastosDuplicados.length },
    { key: 'compromisosCancelados' as const, titulo: 'Compromisos cancelados/anulados', valor: data.compromisosCancelados.length },
  ], [data]);

  return <main className="space-y-4 p-4 md:p-6">{/* UI abreviada por cambios */}
    <h1 className="text-2xl font-semibold">Mantenimiento</h1>
    <div className="flex flex-wrap gap-2"><button onClick={() => void diagnosticar()} disabled={cargando} className="rounded-lg bg-slate-900 px-4 py-2 text-white">{cargando ? 'Ejecutando...' : 'Ejecutar diagnóstico'}</button><button onClick={() => void repararSeguro()} className="rounded-lg border px-4 py-2">Reparar automáticamente lo seguro</button></div>
    {mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map((c) => <button key={c.key} onClick={() => c.valor > 0 && setCardSeleccionada(c.key)} className={`rounded-xl border bg-white p-4 text-left ${c.valor > 0 ? 'cursor-pointer hover:border-slate-400' : 'cursor-default opacity-80'} ${cardSeleccionada === c.key ? 'border-slate-900 ring-1 ring-slate-900' : ''}`}><p className="text-xs text-slate-500">{c.titulo}</p><p className="text-2xl font-bold">{c.valor}</p></button>)}</section>
    {cardSeleccionada === 'compromisosSinCalendario' && <section className="space-y-2 rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Estos compromisos activos sí se pueden reparar regenerando calendario.</p>{data.compromisosSinCalendario.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-9 md:gap-2"><span>{c.cuenta?.nombre_cuenta}</span><span>{c.periodo_pago_estimado}</span><span>{c.fecha_estimada_pago ?? '-'}</span><span>{c.establecimiento}</span><span>{c.monto_cuota}</span><span>{c.persona?.nombre}</span><span>{c.origen_cuota}</span><span>{c.estado}</span><div className="flex gap-2"><button onClick={() => void regenerarCalendario(c)} className="rounded border px-2">Regenerar calendario</button>{c.gasto ? <button className="rounded border px-2" onClick={() => setGastoDetalle(c.gasto)}>Ver gasto</button> : <span className="text-xs text-slate-500">Gasto no disponible</span>}</div></div>)}</section>}
    {cardSeleccionada === 'compromisosHuerfanosAnulados' && <section className="space-y-2 rounded-xl border bg-white p-4"><p className="text-sm text-slate-600">Estos compromisos quedaron sin un gasto activo asociado. Pueden venir de anulaciones o pruebas fallidas. No se deben reparar creando calendarios; se pueden marcar como cancelados.</p>{data.compromisosHuerfanosAnulados.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-10 md:gap-2"><span>{c.cuenta?.nombre_cuenta}</span><span>{c.periodo_pago_estimado}</span><span>{c.fecha_estimada_pago ?? '-'}</span><span>{c.establecimiento}</span><span>{c.monto_cuota}</span><span>{c.persona?.nombre}</span><span>{c.origen_cuota}</span><span>{c.estado}</span><span className="font-medium text-amber-700">{c.motivo_huerfano}</span><div className="flex gap-2"><button onClick={() => void marcarCompromisoCancelado(c)} className="rounded border px-2">Marcar como cancelado</button>{c.gasto ? <button className="rounded border px-2" onClick={() => setGastoDetalle(c.gasto)}>Ver detalle</button> : <span className="text-xs text-slate-500">Gasto no disponible</span>}</div></div>)}</section>}
    {gastoDetalle && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><div className="w-full max-w-xl rounded-xl bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">Detalle de gasto</h3><button className="rounded border px-2 py-1 text-sm" onClick={() => setGastoDetalle(null)}>Cerrar</button></div><div className="grid grid-cols-2 gap-2 text-sm"><span>Fecha</span><span>{gastoDetalle.fecha_gasto ?? '-'}</span><span>Establecimiento</span><span>{gastoDetalle.establecimiento ?? '-'}</span><span>Monto</span><span>{gastoDetalle.monto ?? '-'}</span><span>Moneda</span><span>{gastoDetalle.moneda ?? '-'}</span><span>Persona</span><span>{gastoDetalle.persona?.nombre ?? '-'}</span><span>Categoría</span><span>{gastoDetalle.categoria?.nombre ?? '-'}</span><span>Medio de pago</span><span>{gastoDetalle.medio_pago?.tipo ?? '-'}</span><span>Cuenta de tarjeta</span><span>{gastoDetalle.cuenta?.nombre_cuenta ?? '-'}</span><span>Tarjeta física</span><span>{gastoDetalle.tarjeta?.alias ?? '-'}</span><span>Estado</span><span>{gastoDetalle.estado_registro ?? '-'}</span><span>Observaciones</span><span>{gastoDetalle.observaciones ?? '-'}</span><span>Comprobante</span><span>{gastoDetalle.comprobante?.id ? 'Sí' : 'No'}</span></div></div></div>}
  </main>;
}
