'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { consolidarDuplicadosCalendario, obtenerOCrearCalendarioEstimado, type CalendarioTarjetaDB } from '@/lib/calendario-tarjetas';
import { calcularPeriodoResumenYVencimiento } from '@/utils/tarjetas';

type AnyObj = Record<string, any>;
type DiagnosticoKey =
  | 'gastosSinCompromiso'
  | 'compromisosSinCalendario'
  | 'duplicadosCalendario'
  | 'calendariosSinUso'
  | 'gastosDuplicados'
  | 'compromisosCancelados';

export default function MantenimientoPage() {
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [cardSeleccionada, setCardSeleccionada] = useState<DiagnosticoKey | null>(null);
  const [data, setData] = useState({
    gastosSinCompromiso: [] as AnyObj[],
    compromisosSinCalendario: [] as AnyObj[],
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
    const [gastosRes, cuotasRes, calendariosRes] = await Promise.all([
      supabase
        .from('gastos')
        .select(
          'id,fecha_gasto,establecimiento,monto,moneda,estado_registro,creado_en,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,persona:personas(nombre,apellido),cuenta:cuentas_tarjeta(id,nombre_cuenta,dia_cierre_habitual,dias_hasta_vencimiento),tarjeta:tarjetas_fisicas(alias,tipo,ultimos_4_digitos),medio_pago:medios_pago(tipo),comprobante:comprobantes(id)',
        )
        .neq('estado_registro', 'anulado'),
      supabase
        .from('cuotas_tarjeta')
        .select(
          'id,gasto_id,cuenta_tarjeta_id,periodo_pago_estimado,estado,establecimiento,persona_id,monto_cuota,numero_cuota,total_cuotas,moneda,origen_cuota,fecha_estimada_pago,cuenta:cuentas_tarjeta(id,nombre_cuenta,dia_cierre_habitual,dias_hasta_vencimiento),gasto:gastos(id,fecha_gasto,establecimiento,estado_registro),persona:personas(nombre,apellido)',
        )
        .neq('estado', 'cancelada'),
      supabase
        .from('calendario_tarjetas')
        .select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones,creado_en')
        .order('creado_en', { ascending: true }),
    ]);

    if (gastosRes.error || cuotasRes.error || calendariosRes.error) {
      setMensaje('No se pudo ejecutar diagnóstico.');
      setCargando(false);
      return;
    }

    const gastos = (gastosRes.data ?? []) as AnyObj[];
    const cuotas = (cuotasRes.data ?? []) as AnyObj[];
    const calendarios = (calendariosRes.data ?? []) as CalendarioTarjetaDB[];
    const gastosTarjeta = gastos.filter((g) => g.medio_pago?.tipo === 'tarjeta_credito' && g.cuenta_tarjeta_id);

    const gastosSinCompromiso = gastosTarjeta.filter((g) => !cuotas.some((c) => c.gasto_id === g.id));
    const compromisosSinCalendario = cuotas.filter(
      (c) => !calendarios.some((cal) => cal.cuenta_tarjeta_id === c.cuenta_tarjeta_id && cal.periodo_resumen === c.periodo_pago_estimado),
    );

    const mapaDup = new Map<string, CalendarioTarjetaDB[]>();
    calendarios.forEach((c) => {
      const key = `${c.cuenta_tarjeta_id}::${c.periodo_resumen}`;
      mapaDup.set(key, [...(mapaDup.get(key) ?? []), c]);
    });
    const duplicadosCalendario = Array.from(mapaDup.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({ key, items }));

    const keysGasto = new Set(
      gastosTarjeta.map((g) => `${g.cuenta_tarjeta_id}::${estimarPeriodo(g.fecha_gasto, g.cuenta?.dia_cierre_habitual, g.cuenta?.dias_hasta_vencimiento)}`),
    );
    const keysCuota = new Set(cuotas.map((c) => `${c.cuenta_tarjeta_id}::${c.periodo_pago_estimado}`));
    const calendariosSinUso = calendarios.filter(
      (c) => !keysGasto.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`) && !keysCuota.has(`${c.cuenta_tarjeta_id}::${c.periodo_resumen}`),
    );

    const sospechosos = new Map<string, AnyObj[]>();
    gastosTarjeta.forEach((g) => {
      const key = `${g.fecha_gasto}|${(g.establecimiento ?? '').trim().toLowerCase()}|${g.monto}|${g.persona_id}|${g.cuenta_tarjeta_id}`;
      sospechosos.set(key, [...(sospechosos.get(key) ?? []), g]);
    });
    const gastosDuplicados = Array.from(sospechosos.entries()).filter(([, items]) => items.length > 1).map(([key, items]) => ({ key, items }));

    const compromisosCancelados = (cuotasRes.data ?? []).filter((c: AnyObj) => ['cancelada', 'anulada'].includes(String(c.estado ?? '').toLowerCase()));

    const nuevo = { gastosSinCompromiso, compromisosSinCalendario, duplicadosCalendario, calendariosSinUso, gastosDuplicados, compromisosCancelados };
    setData(nuevo);
    if (cardSeleccionada && (nuevo[cardSeleccionada] as AnyObj[]).length === 0) setCardSeleccionada(null);
    const total = Object.values(nuevo).reduce((acc, v) => acc + v.length, 0);
    setMensaje(total === 0 ? 'No se detectaron inconsistencias.' : 'Diagnóstico completado.');
    setCargando(false);
  }

  async function generarCompromiso(gasto: AnyObj) {
    if (!gasto.cuenta_tarjeta_id || !gasto.persona_id) return;
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
    await obtenerOCrearCalendarioEstimado({ supabase, cuenta: { id: c.cuenta_tarjeta_id, nombre_cuenta: c.cuenta?.nombre_cuenta, dia_cierre_habitual: c.cuenta?.dia_cierre_habitual ?? null, dias_hasta_vencimiento: c.cuenta?.dias_hasta_vencimiento ?? null }, periodo: c.periodo_pago_estimado, contexto: 'calendario' });
    setMensaje('Calendario regenerado correctamente.');
    await diagnosticar();
  }

  async function consolidarGrupo(grupo: { items: CalendarioTarjetaDB[] }) {
    await consolidarDuplicadosCalendario(supabase, grupo.items);
    setMensaje('Duplicados consolidados.');
    await diagnosticar();
  }

  async function eliminarCalendario(cal: AnyObj) {
    if (!window.confirm('¿Eliminar calendario sin uso?')) return;
    const clave = `${cal.cuenta_tarjeta_id}::${cal.periodo_resumen}`;
    const [gastosRel, cuotasRel] = await Promise.all([
      supabase.from('gastos').select('id').eq('cuenta_tarjeta_id', cal.cuenta_tarjeta_id),
      supabase.from('cuotas_tarjeta').select('id').eq('cuenta_tarjeta_id', cal.cuenta_tarjeta_id).eq('periodo_pago_estimado', cal.periodo_resumen),
    ]);
    const periodoEnGasto = (gastosRel.data ?? []).some((g: AnyObj) => data.gastosSinCompromiso.concat(...data.gastosDuplicados.map((dg) => dg.items)).find((it) => it.id === g.id));
    if (periodoEnGasto || (cuotasRel.data ?? []).length > 0 || data.compromisosSinCalendario.some((c) => `${c.cuenta_tarjeta_id}::${c.periodo_pago_estimado}` === clave)) {
      setMensaje('No se puede eliminar: el calendario tiene datos asociados.');
      return;
    }
    await supabase.from('calendario_tarjetas').delete().eq('id', cal.id);
    setMensaje('Calendario eliminado.');
    await diagnosticar();
  }

  async function anularGasto(id: string) {
    if (!window.confirm('¿Confirmás anular este gasto? Esta acción no borra datos, solo los anula.')) return;
    await supabase.from('gastos').update({ estado_registro: 'anulado', actualizado_en: new Date().toISOString() }).eq('id', id);
    await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada', actualizado_en: new Date().toISOString(), observaciones: 'Cancelada por anulación de gasto duplicado.' }).eq('gasto_id', id).neq('estado', 'pagada');
    setMensaje('Gasto anulado y compromisos no pagados cancelados.');
    await diagnosticar();
  }

  async function repararSeguro() {
    for (const c of data.compromisosSinCalendario) await regenerarCalendario(c);
    for (const g of data.duplicadosCalendario) await consolidarGrupo(g);
    setMensaje('Reparación automática segura finalizada: se regeneraron calendarios faltantes y se consolidaron duplicados claros.');
    await diagnosticar();
  }

  const cards = useMemo(
    () => [
      { key: 'gastosSinCompromiso' as const, titulo: 'Gastos de tarjeta sin compromiso', valor: data.gastosSinCompromiso.length },
      { key: 'compromisosSinCalendario' as const, titulo: 'Compromisos sin calendario', valor: data.compromisosSinCalendario.length },
      { key: 'duplicadosCalendario' as const, titulo: 'Calendarios duplicados', valor: data.duplicadosCalendario.length },
      { key: 'calendariosSinUso' as const, titulo: 'Calendarios sin uso', valor: data.calendariosSinUso.length },
      { key: 'gastosDuplicados' as const, titulo: 'Gastos duplicados sospechosos', valor: data.gastosDuplicados.length },
      { key: 'compromisosCancelados' as const, titulo: 'Compromisos cancelados/anulados', valor: data.compromisosCancelados.length },
    ],
    [data],
  );

  return (
    <main className="space-y-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">Mantenimiento</h1>
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        Estas herramientas sirven para corregir datos inconsistentes generados durante pruebas o errores de carga.
      </p>
      <div className="rounded-lg border bg-slate-50 p-3 text-xs text-slate-600">
        Reparación automática segura: regenera calendarios faltantes y consolida duplicados claros. No anula gastos automáticamente, no borra gastos y no borra compromisos.
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void diagnosticar()} disabled={cargando} className="rounded-lg bg-slate-900 px-4 py-2 text-white">{cargando ? 'Ejecutando...' : 'Ejecutar diagnóstico'}</button>
        <button onClick={() => void repararSeguro()} className="rounded-lg border px-4 py-2">Reparar automáticamente lo seguro</button>
      </div>
      {mensaje && <p className="text-sm text-slate-600">{mensaje}</p>}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const clickable = c.valor > 0;
          return (
            <button
              key={c.key}
              onClick={() => clickable && setCardSeleccionada(c.key)}
              className={`rounded-xl border bg-white p-4 text-left ${clickable ? 'cursor-pointer hover:border-slate-400' : 'cursor-default opacity-80'} ${cardSeleccionada === c.key ? 'border-slate-900 ring-1 ring-slate-900' : ''}`}
            >
              <p className="text-xs text-slate-500">{c.titulo}</p>
              <p className="text-2xl font-bold">{c.valor}</p>
              {!clickable && <p className="mt-1 text-xs text-slate-400">No hay registros para revisar.</p>}
            </button>
          );
        })}
      </section>

      {cardSeleccionada && (
        <section className="space-y-3 rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{cards.find((c) => c.key === cardSeleccionada)?.titulo}</h2>
            <button className="rounded-md border px-2 py-1 text-sm" onClick={() => setCardSeleccionada(null)}>Cerrar detalle</button>
          </div>

          {cardSeleccionada === 'gastosSinCompromiso' && <div className="space-y-2"><p className="text-sm text-slate-600">Estos gastos figuran como tarjeta, pero no tienen compromiso asociado para aparecer correctamente en el flujo.</p>{data.gastosSinCompromiso.map((g) => <div key={g.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-9 md:gap-2"><span>{g.fecha_gasto}</span><span>{g.establecimiento}</span><span>{g.monto}</span><span>{g.moneda}</span><span>{g.persona?.nombre}</span><span>{g.cuenta?.nombre_cuenta}</span><span>{g.tarjeta?.alias ?? '-'}</span><span>{g.estado_registro}</span><div className="flex gap-2"><button onClick={()=>void generarCompromiso(g)} className="rounded border px-2">Generar compromiso</button><Link className="rounded border px-2" href={`/gastos/${g.id}`}>Ver gasto</Link><button onClick={()=>void anularGasto(g.id)} className="rounded border px-2">Anular</button></div></div>)}</div>}

          {cardSeleccionada === 'compromisosSinCalendario' && <div className="space-y-2"><p className="text-sm text-slate-600">Estos compromisos aparecen en el flujo, pero falta el calendario de cierre/vencimiento que los respalde.</p>{data.compromisosSinCalendario.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-8 md:gap-2"><span>{c.cuenta?.nombre_cuenta}</span><span>{c.periodo_pago_estimado}</span><span>{c.fecha_estimada_pago ?? '-'}</span><span>{c.establecimiento}</span><span>{c.monto_cuota}</span><span>{c.persona?.nombre}</span><span>{c.origen_cuota}</span><div className="flex gap-2"><button onClick={()=>void regenerarCalendario(c)} className="rounded border px-2">Regenerar calendario</button>{c.gasto_id && <Link className="rounded border px-2" href={`/gastos/${c.gasto_id}`}>Ver gasto</Link>}</div></div>)}</div>}

          {cardSeleccionada === 'duplicadosCalendario' && <div className="space-y-2"><p className="text-sm text-slate-600">Hay más de un calendario para la misma cuenta y período. La app conservará un calendario principal y eliminará duplicados seguros.</p>{data.duplicadosCalendario.map((g) => <div key={g.key} className="rounded-lg border p-3"><div className="mb-2 text-sm font-medium">Grupo: {g.key}</div>{g.items.map((it) => <div key={it.id} className="grid grid-cols-2 gap-2 text-xs md:grid-cols-8"><span>{it.id.slice(0, 8)}</span><span>{it.fecha_cierre}</span><span>{it.fecha_vencimiento}</span><span>{it.estado_calendario}</span><span>{it.origen_fecha}</span><span>{it.observaciones ?? '-'}</span><span>{it.creado_en?.slice(0, 10)}</span><span>Sin vínculos</span></div>)}<button onClick={()=>void consolidarGrupo(g)} className="mt-2 rounded border px-2 py-1 text-sm">Consolidar duplicados</button></div>)}</div>}

          {cardSeleccionada === 'calendariosSinUso' && <div className="space-y-2"><p className="text-sm text-slate-600">Estos calendarios no tienen gastos ni pagos asociados. Podés eliminarlos si no los necesitás.</p>{data.calendariosSinUso.map((c) => <div key={c.id} className="rounded-lg border p-3 text-sm md:grid md:grid-cols-8 md:gap-2"><span>{c.cuenta_tarjeta_id}</span><span>{c.periodo_resumen}</span><span>{c.fecha_cierre}</span><span>{c.fecha_vencimiento}</span><span>{c.estado_calendario}</span><span>{c.origen_fecha}</span><span>{c.observaciones ?? '-'}</span><div className="flex gap-2"><button onClick={()=>void eliminarCalendario(c)} className="rounded border px-2">Eliminar calendario</button><Link href={`/configuracion/cuentas-tarjeta/${c.cuenta_tarjeta_id}`} className="rounded border px-2">Ver cuenta</Link></div></div>)}</div>}

          {cardSeleccionada === 'gastosDuplicados' && <div className="space-y-2"><p className="text-sm text-slate-600">Estos gastos se parecen entre sí y podrían ser duplicados por reintentos de carga. Revisalos antes de anular.</p>{data.gastosDuplicados.map((grupo) => <div key={grupo.key} className="rounded-lg border p-3"><p className="text-xs text-slate-500">Grupo sospechoso: {grupo.key}</p>{grupo.items.map((g) => <div key={g.id} className="mt-2 rounded border p-2 text-sm md:grid md:grid-cols-9 md:gap-2"><span>{g.fecha_gasto}</span><span>{g.establecimiento}</span><span>{g.monto}</span><span>{g.medio_pago?.tipo}</span><span>{g.persona?.nombre}</span><span>{g.cuenta?.nombre_cuenta}</span><span>{g.creado_en?.slice(0, 10)}</span><span>{g.estado_registro}</span><div className="flex gap-2"><Link className="rounded border px-2" href={`/gastos/${g.id}`}>Ver</Link><button onClick={()=>void anularGasto(g.id)} className="rounded border px-2">Anular gasto</button></div></div>)}</div>)}</div>}

          {cardSeleccionada === 'compromisosCancelados' && <div className="space-y-2"><p className="text-sm text-slate-600">Estos registros no deberían afectar el flujo si están cancelados o anulados.</p>{data.compromisosCancelados.length === 0 && <p className="text-sm text-slate-500">No hay registros para revisar.</p>}</div>}
        </section>
      )}
    </main>
  );
}
