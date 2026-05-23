'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { calcularPeriodoResumenYVencimiento } from '@/utils/tarjetas';
import { consolidarDuplicadosCalendario, obtenerOCrearCalendarioEstimado, type CalendarioTarjetaDB } from '@/lib/calendario-tarjetas';

type AnyObj = Record<string, any>;

export default function MantenimientoPage() {
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string>('');
  const [data, setData] = useState({ gastosSinCompromiso: [] as AnyObj[], compromisosSinCalendario: [] as AnyObj[], duplicadosCalendario: [] as { key: string; items: CalendarioTarjetaDB[] }[], calendariosSinUso: [] as AnyObj[], gastosDuplicados: [] as { key: string; items: AnyObj[] }[] });

  const card = (titulo: string, valor: number) => <div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{titulo}</p><p className="text-2xl font-bold">{valor}</p></div>;

  async function diagnosticar() {
    setCargando(true); setMensaje('');
    const [gastosRes, cuotasRes, calendariosRes] = await Promise.all([
      supabase.from('gastos').select('id,fecha_gasto,establecimiento,monto,moneda,estado_registro,creado_en,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,persona:personas(nombre,apellido),cuenta:cuentas_tarjeta(nombre_cuenta,dia_cierre_habitual,dias_hasta_vencimiento),tarjeta:tarjetas_fisicas(alias,tipo,ultimos_4_digitos),medio_pago:medios_pago(tipo)').neq('estado_registro', 'anulado'),
      supabase.from('cuotas_tarjeta').select('id,gasto_id,cuenta_tarjeta_id,periodo_pago_estimado,estado,establecimiento,persona_id,monto_cuota,numero_cuota,total_cuotas,moneda,cuenta:cuentas_tarjeta(nombre_cuenta,dia_cierre_habitual,dias_hasta_vencimiento),gasto:gastos(fecha_gasto,establecimiento)').neq('estado', 'cancelada'),
      supabase.from('calendario_tarjetas').select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones,creado_en').order('creado_en', { ascending: true }),
    ]);
    if (gastosRes.error || cuotasRes.error || calendariosRes.error) { setMensaje('No se pudo ejecutar diagnóstico.'); setCargando(false); return; }
    const gastos = (gastosRes.data ?? []) as AnyObj[];
    const cuotas = (cuotasRes.data ?? []) as AnyObj[];
    const calendarios = (calendariosRes.data ?? []) as CalendarioTarjetaDB[];
    const gastosTarjeta = gastos.filter((g) => g.medio_pago?.tipo === 'tarjeta_credito' && g.cuenta_tarjeta_id);

    const gastosSinCompromiso = gastosTarjeta.filter((g) => !cuotas.some((c) => c.gasto_id === g.id));
    const compromisosSinCalendario = cuotas.filter((c) => !calendarios.some((cal) => cal.cuenta_tarjeta_id === c.cuenta_tarjeta_id && cal.periodo_resumen === c.periodo_pago_estimado));

    const mapaDup = new Map<string, CalendarioTarjetaDB[]>();
    calendarios.forEach((c) => { const key = `${c.cuenta_tarjeta_id}::${c.periodo_resumen}`; mapaDup.set(key, [...(mapaDup.get(key) ?? []), c]); });
    const duplicadosCalendario = Array.from(mapaDup.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items }));

    const keysGasto = new Set(gastosTarjeta.map((g) => `${g.cuenta_tarjeta_id}::${estimarPeriodo(g.fecha_gasto, g.cuenta?.dia_cierre_habitual, g.cuenta?.dias_hasta_vencimiento)}`));
    const keysCuota = new Set(cuotas.map((c) => `${c.cuenta_tarjeta_id}::${c.periodo_pago_estimado}`));
    const calendariosSinUso = calendarios.filter((c) => !keysGasto.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`) && !keysCuota.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`));

    const sospechosos = new Map<string, AnyObj[]>();
    gastosTarjeta.forEach((g) => {
      const key = `${g.fecha_gasto}|${(g.establecimiento ?? '').trim().toLowerCase()}|${g.monto}|${g.persona_id}|${g.cuenta_tarjeta_id}`;
      sospechosos.set(key, [...(sospechosos.get(key) ?? []), g]);
    });
    const gastosDuplicados = Array.from(sospechosos.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items }));

    setData({ gastosSinCompromiso, compromisosSinCalendario, duplicadosCalendario, calendariosSinUso, gastosDuplicados });
    setMensaje(gastosSinCompromiso.length + compromisosSinCalendario.length + duplicadosCalendario.length + calendariosSinUso.length + gastosDuplicados.length === 0 ? 'No se detectaron inconsistencias.' : 'Diagnóstico completado.');
    setCargando(false);
  }

  const estimarPeriodo = (fecha: string, dia: number | null, dias: number | null) => (!dia || dias === null ? fecha.slice(0, 7) : calcularPeriodoResumenYVencimiento({ fecha_gasto: fecha, dia_cierre_habitual: dia, dias_hasta_vencimiento: dias }).periodo_resumen);

  async function generarCompromiso(gasto: AnyObj) {
    if (!gasto.cuenta_tarjeta_id || !gasto.persona_id) return;
    if (data.gastosSinCompromiso.find((g) => g.id === gasto.id) === undefined) return;
    const periodo = estimarPeriodo(gasto.fecha_gasto, gasto.cuenta?.dia_cierre_habitual ?? null, gasto.cuenta?.dias_hasta_vencimiento ?? null);
    await obtenerOCrearCalendarioEstimado({ supabase, cuenta: { id: gasto.cuenta_tarjeta_id, nombre_cuenta: gasto.cuenta?.nombre_cuenta, dia_cierre_habitual: gasto.cuenta?.dia_cierre_habitual ?? null, dias_hasta_vencimiento: gasto.cuenta?.dias_hasta_vencimiento ?? null }, periodo, contexto: 'gasto' });
    const yaExiste = await supabase.from('cuotas_tarjeta').select('id').eq('gasto_id', gasto.id).limit(1);
    if (!yaExiste.error && (yaExiste.data ?? []).length === 0) {
      await supabase.from('cuotas_tarjeta').insert({ gasto_id: gasto.id, cuenta_tarjeta_id: gasto.cuenta_tarjeta_id, tarjeta_fisica_id: gasto.tarjeta_fisica_id, persona_id: gasto.persona_id, establecimiento: gasto.establecimiento, numero_cuota: 1, total_cuotas: 1, monto_cuota: gasto.monto, moneda: gasto.moneda, periodo_pago_estimado: periodo, estado: 'pendiente', origen_cuota: 'ajuste_manual', observaciones: 'Compromiso generado desde mantenimiento.' });
    }
    setMensaje('Compromiso generado correctamente.');
    await diagnosticar();
  }

  async function regenerarCalendario(c: AnyObj) {
    const periodo = c.periodo_pago_estimado;
    await obtenerOCrearCalendarioEstimado({ supabase, cuenta: { id: c.cuenta_tarjeta_id, nombre_cuenta: c.cuenta?.nombre_cuenta, dia_cierre_habitual: c.cuenta?.dia_cierre_habitual ?? null, dias_hasta_vencimiento: c.cuenta?.dias_hasta_vencimiento ?? null }, periodo, contexto: 'calendario' });
    setMensaje('Calendario regenerado correctamente.');
    await diagnosticar();
  }

  async function consolidarGrupo(grupo: { items: CalendarioTarjetaDB[] }) { await consolidarDuplicadosCalendario(supabase, grupo.items); setMensaje('Duplicados consolidados.'); await diagnosticar(); }
  async function eliminarCalendario(id: string) { if (!window.confirm('¿Eliminar calendario sin uso?')) return; await supabase.from('calendario_tarjetas').delete().eq('id', id); setMensaje('Calendario eliminado.'); await diagnosticar(); }
  async function anularGasto(id: string) { await supabase.from('gastos').update({ estado_registro: 'anulado', actualizado_en: new Date().toISOString() }).eq('id', id); await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada', actualizado_en: new Date().toISOString(), observaciones: 'Cancelada por anulación de gasto duplicado.' }).eq('gasto_id', id).neq('estado', 'pagada'); setMensaje('Gasto anulado y compromisos no pagados cancelados.'); await diagnosticar(); }

  async function repararSeguro() { for (const c of data.compromisosSinCalendario) await regenerarCalendario(c); for (const g of data.duplicadosCalendario) await consolidarGrupo(g); setMensaje('Reparación automática segura finalizada.'); }

  return <main className="space-y-4 p-4 md:p-6"><h1 className="text-2xl font-semibold">Mantenimiento</h1><p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">Estas herramientas sirven para corregir datos inconsistentes generados durante pruebas o errores de carga.</p><div className="flex flex-wrap gap-2"><button onClick={()=>void diagnosticar()} disabled={cargando} className="rounded-lg bg-slate-900 px-4 py-2 text-white">{cargando ? 'Ejecutando...' : 'Ejecutar diagnóstico'}</button><button onClick={()=>void repararSeguro()} className="rounded-lg border px-4 py-2">Reparar automáticamente lo seguro</button></div>{mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{card('Gastos de tarjeta sin compromiso', data.gastosSinCompromiso.length)}{card('Compromisos sin calendario', data.compromisosSinCalendario.length)}{card('Calendarios duplicados', data.duplicadosCalendario.length)}{card('Calendarios sin uso', data.calendariosSinUso.length)}{card('Gastos duplicados sospechosos', data.gastosDuplicados.length)}{card('Compromisos cancelados/anulados', 0)}</section></main>;
}
