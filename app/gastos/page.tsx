'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Gasto = {
  id: string;
  fecha_gasto: string;
  establecimiento: string;
  descripcion: string | null;
  observaciones: string | null;
  categoria_id: string;
  monto: number;
  moneda: string;
  medio_pago_id: string;
  persona_id: string;
  cuenta_tarjeta_id: string | null;
  tarjeta_fisica_id: string | null;
  cantidad_cuotas: number;
  estado_registro: 'borrador' | 'confirmado' | 'anulado';
  creado_en: string;
};

type OpcionBase = { id: string; nombre: string };
type Persona = { id: string; nombre: string; apellido: string | null };
type CuentaTarjeta = { id: string; nombre_cuenta: string };
type TarjetaFisica = {
  id: string;
  cuenta_tarjeta_id: string;
  persona_id: string | null;
  tipo: string;
  nombre_en_tarjeta: string | null;
  alias: string | null;
  ultimos_4_digitos: string | null;
  activo: boolean;
};
type CuotaTarjeta = {
  id: string;
  gasto_id: string | null;
  numero_cuota: number;
  total_cuotas: number;
  periodo_pago_estimado: string;
  monto_cuota: number;
  estado: string;
  origen_cuota: string;
  persona_id: string;
  tarjeta_fisica_id: string | null;
  cuenta_tarjeta_id: string;
  observaciones: string | null;
  motivo_modificacion?: string | null;
};

type Filtros = {
  busqueda: string;
  fecha_desde: string;
  fecha_hasta: string;
  categoria_id: string;
  persona_id: string;
  medio_pago_id: string;
  cuenta_tarjeta_id: string;
  tarjeta_fisica_id: string;
  estado_registro: 'activos' | 'anulados' | 'todos';
};

const ESTADOS_EDITABLES_CUOTA = new Set(['pendiente', 'proyectada', 'no_incluida', 'reprogramada']);
const FILTROS_INICIALES: Filtros = { busqueda: '', fecha_desde: '', fecha_hasta: '', categoria_id: '', persona_id: '', medio_pago_id: '', cuenta_tarjeta_id: '', tarjeta_fisica_id: '', estado_registro: 'activos' };

export default function Page() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cuotas, setCuotas] = useState<CuotaTarjeta[]>([]);
  const [categorias, setCategorias] = useState<OpcionBase[]>([]);
  const [mediosPago, setMediosPago] = useState<OpcionBase[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentasTarjeta, setCuentasTarjeta] = useState<CuentaTarjeta[]>([]);
  const [tarjetasFisicas, setTarjetasFisicas] = useState<TarjetaFisica[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  useEffect(() => { void cargarDatos(); }, []);

  const nombresCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const nombresMedioPago = useMemo(() => new Map(mediosPago.map((m) => [m.id, m.nombre])), [mediosPago]);
  const nombresPersona = useMemo(() => new Map(personas.map((p) => [p.id, `${p.nombre} ${p.apellido ?? ''}`.trim()])), [personas]);
  const nombresCuenta = useMemo(() => new Map(cuentasTarjeta.map((c) => [c.id, c.nombre_cuenta])), [cuentasTarjeta]);

  const tarjetasEtiquetas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const t of tarjetasFisicas) {
      const persona = t.persona_id ? nombresPersona.get(t.persona_id) ?? t.nombre_en_tarjeta ?? 'Tarjeta' : t.nombre_en_tarjeta ?? 'Tarjeta';
      const base = t.alias?.trim() ? t.alias.trim() : `${persona} ${t.tipo}`.trim();
      mapa.set(t.id, t.ultimos_4_digitos ? `${base} · ****${t.ultimos_4_digitos}` : base);
    }
    return mapa;
  }, [tarjetasFisicas, nombresPersona]);

  const cuotasPorGasto = useMemo(() => cuotas.reduce((acc, cuota) => {
    if (!cuota.gasto_id) return acc;
    acc.set(cuota.gasto_id, (acc.get(cuota.gasto_id) ?? 0) + 1);
    return acc;
  }, new Map<string, number>()), [cuotas]);

  const cuotasGastoEditando = useMemo(() => gastoEditando ? cuotas.filter((c) => c.gasto_id === gastoEditando.id) : [], [cuotas, gastoEditando]);
  const gastoEditandoTieneCuotas = cuotasGastoEditando.length > 0;

  const gastosFiltrados = useMemo(() => gastos.filter((gasto) => {
    if (filtros.estado_registro === 'activos' && gasto.estado_registro === 'anulado') return false;
    if (filtros.estado_registro === 'anulados' && gasto.estado_registro !== 'anulado') return false;
    if (filtros.fecha_desde && gasto.fecha_gasto < filtros.fecha_desde) return false;
    if (filtros.fecha_hasta && gasto.fecha_gasto > filtros.fecha_hasta) return false;
    if (filtros.categoria_id && gasto.categoria_id !== filtros.categoria_id) return false;
    if (filtros.persona_id && gasto.persona_id !== filtros.persona_id) return false;
    if (filtros.medio_pago_id && gasto.medio_pago_id !== filtros.medio_pago_id) return false;
    if (filtros.cuenta_tarjeta_id && gasto.cuenta_tarjeta_id !== filtros.cuenta_tarjeta_id) return false;
    if (filtros.tarjeta_fisica_id && gasto.tarjeta_fisica_id !== filtros.tarjeta_fisica_id) return false;
    const texto = filtros.busqueda.trim().toLowerCase();
    if (!texto) return true;
    const bolsa = [gasto.establecimiento, gasto.descripcion ?? '', gasto.observaciones ?? '', String(gasto.monto), nombresPersona.get(gasto.persona_id) ?? '', nombresCategoria.get(gasto.categoria_id) ?? '', nombresMedioPago.get(gasto.medio_pago_id) ?? '', gasto.cuenta_tarjeta_id ? nombresCuenta.get(gasto.cuenta_tarjeta_id) ?? '' : '', gasto.tarjeta_fisica_id ? tarjetasEtiquetas.get(gasto.tarjeta_fisica_id) ?? '' : ''].join(' ').toLowerCase();
    return bolsa.includes(texto);
  }), [filtros, gastos, nombresPersona, nombresCategoria, nombresMedioPago, nombresCuenta, tarjetasEtiquetas]);

  const totalOperativo = gastosFiltrados.filter((g) => g.estado_registro !== 'anulado').reduce((acc, g) => acc + g.monto, 0);
  const totalAnulado = gastosFiltrados.filter((g) => g.estado_registro === 'anulado').reduce((acc, g) => acc + g.monto, 0);

  const esMedioTarjetaCredito = (medioId: string) => (nombresMedioPago.get(medioId) ?? '').toLowerCase().includes('tarjeta') && (nombresMedioPago.get(medioId) ?? '').toLowerCase().includes('cr');
  const gastoEditandoEsTarjeta = gastoEditando ? esMedioTarjetaCredito(gastoEditando.medio_pago_id) : false;

  const tarjetasDisponiblesEdicion = useMemo(() => {
    if (!gastoEditando?.cuenta_tarjeta_id) return [];
    const ids = new Set<string>();
    const asociadas = tarjetasFisicas.filter((t) => t.cuenta_tarjeta_id === gastoEditando.cuenta_tarjeta_id && (t.activo || t.id === gastoEditando.tarjeta_fisica_id));
    return asociadas.filter((t) => (ids.has(t.id) ? false : (ids.add(t.id), true))).map((t) => ({ id: t.id, nombre: tarjetasEtiquetas.get(t.id) ?? 'Tarjeta' }));
  }, [gastoEditando, tarjetasFisicas, tarjetasEtiquetas]);

  async function cargarDatos() {
    const [g, c, m, p, ct, tf, cuotasRes] = await Promise.all([
      supabase.from('gastos').select('id,fecha_gasto,establecimiento,descripcion,observaciones,categoria_id,monto,moneda,medio_pago_id,persona_id,cuenta_tarjeta_id,tarjeta_fisica_id,cantidad_cuotas,estado_registro,creado_en').order('fecha_gasto', { ascending: false }),
      supabase.from('categorias').select('id,nombre').order('nombre'),
      supabase.from('medios_pago').select('id,nombre').order('nombre'),
      supabase.from('personas').select('id,nombre,apellido').order('nombre'),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta').order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,cuenta_tarjeta_id,persona_id,tipo,nombre_en_tarjeta,alias,ultimos_4_digitos,activo').order('id'),
      supabase.from('cuotas_tarjeta').select('id,gasto_id,numero_cuota,total_cuotas,periodo_pago_estimado,monto_cuota,estado,origen_cuota,persona_id,tarjeta_fisica_id,cuenta_tarjeta_id,observaciones,motivo_modificacion')
    ]);
    if (g.error || c.error || m.error || p.error || ct.error || tf.error || cuotasRes.error) return setError('No se pudieron cargar los datos de gastos.');
    setGastos((g.data ?? []) as Gasto[]); setCategorias((c.data ?? []) as OpcionBase[]); setMediosPago((m.data ?? []) as OpcionBase[]); setPersonas((p.data ?? []) as Persona[]); setCuentasTarjeta((ct.data ?? []) as CuentaTarjeta[]); setTarjetasFisicas((tf.data ?? []) as TarjetaFisica[]); setCuotas((cuotasRes.data ?? []) as CuotaTarjeta[]);
  }

  async function guardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!gastoEditando) return;
    const original = gastos.find((g) => g.id === gastoEditando.id);
    if (!original) return;
    const tieneCuotas = cuotasGastoEditando.length > 0;
    const originalTarjeta = esMedioTarjetaCredito(original.medio_pago_id);
    const nuevoTarjeta = esMedioTarjetaCredito(gastoEditando.medio_pago_id);

    if (tieneCuotas && original.medio_pago_id !== gastoEditando.medio_pago_id) return setError('Este gasto tiene cuotas generadas. Para cambiar el medio de pago, anulá el gasto y cargalo nuevamente.');
    if (!originalTarjeta && nuevoTarjeta) return setError('Para convertir este gasto a tarjeta de crédito y generar cuotas, anulá este gasto y cargalo nuevamente desde Nuevo gasto.');
    if (tieneCuotas && original.cuenta_tarjeta_id !== gastoEditando.cuenta_tarjeta_id) return setError('Para cambiar la cuenta de tarjeta de un gasto con cuotas, anulá el gasto y cargalo nuevamente.');
    if (nuevoTarjeta && (!gastoEditando.cuenta_tarjeta_id || !gastoEditando.tarjeta_fisica_id)) return setError('Para un gasto con tarjeta de crédito, debés seleccionar cuenta de tarjeta y tarjeta física.');

    const payload = {
      establecimiento: gastoEditando.establecimiento.trim(), categoria_id: gastoEditando.categoria_id, persona_id: gastoEditando.persona_id, descripcion: gastoEditando.descripcion, observaciones: gastoEditando.observaciones,
      ...(tieneCuotas ? { tarjeta_fisica_id: gastoEditando.tarjeta_fisica_id } : { fecha_gasto: gastoEditando.fecha_gasto, monto: gastoEditando.monto, medio_pago_id: gastoEditando.medio_pago_id, cuenta_tarjeta_id: nuevoTarjeta ? gastoEditando.cuenta_tarjeta_id : null, tarjeta_fisica_id: nuevoTarjeta ? gastoEditando.tarjeta_fisica_id : null, cantidad_cuotas: nuevoTarjeta ? gastoEditando.cantidad_cuotas : 1 }),
    };
    const { error: e } = await supabase.from('gastos').update(payload).eq('id', gastoEditando.id);
    if (e) return setError('No se pudo guardar la edición.');
    if (tieneCuotas) {
      if (original.persona_id !== gastoEditando.persona_id) await supabase.from('cuotas_tarjeta').update({ persona_id: gastoEditando.persona_id }).eq('gasto_id', gastoEditando.id).not('estado', 'in', '("pagada","cancelada")');
      if (original.tarjeta_fisica_id !== gastoEditando.tarjeta_fisica_id) await supabase.from('cuotas_tarjeta').update({ tarjeta_fisica_id: gastoEditando.tarjeta_fisica_id }).eq('gasto_id', gastoEditando.id).not('estado', 'in', '("pagada","cancelada")');
    }
    setMensajeExito('Gasto actualizado correctamente.'); setGastoEditando(null); await cargarDatos();
  }

  async function actualizarCuotaAsociada(cuota: CuotaTarjeta, cambios: { periodo_pago_estimado: string; observaciones: string | null }) {
    if (!ESTADOS_EDITABLES_CUOTA.has(cuota.estado)) return;
    const payload = {
      periodo_pago_estimado: cambios.periodo_pago_estimado,
      observaciones: cambios.observaciones,
      estado: 'reprogramada',
      motivo_modificacion: 'Período modificado manualmente desde historial de gastos.',
    };
    const { error: cuotaError } = await supabase.from('cuotas_tarjeta').update(payload).eq('id', cuota.id);
    if (cuotaError) return setError('No se pudo actualizar la cuota asociada.');
    setMensajeExito('Se actualizó el período estimado de pago de la cuota.');
    await cargarDatos();
  }

  async function anularGasto(gasto: Gasto) {
    await supabase.from('gastos').update({ estado_registro: 'anulado' }).eq('id', gasto.id);
    await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada' }).eq('gasto_id', gasto.id).neq('estado', 'pagada');
    setMensajeExito('Gasto anulado correctamente. Las cuotas pendientes asociadas fueron canceladas.');
    await cargarDatos();
  }

  return <section className="space-y-4">
    <h1 className="text-2xl font-semibold">Historial de gastos {filtros.estado_registro === 'anulados' ? <span className="ml-2 rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">Vista Anulados</span> : null}</h1>
    {mensajeExito && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensajeExito}</p>}
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

    <div className="grid grid-cols-1 gap-2 rounded-2xl border bg-white p-3 md:grid-cols-3">
      <input className="rounded-xl border px-3 py-2" placeholder="Buscar" value={filtros.busqueda} onChange={(e) => setFiltros((p) => ({ ...p, busqueda: e.target.value }))} />
      <input type="date" className="rounded-xl border px-3 py-2" value={filtros.fecha_desde} onChange={(e) => setFiltros((p) => ({ ...p, fecha_desde: e.target.value }))} />
      <input type="date" className="rounded-xl border px-3 py-2" value={filtros.fecha_hasta} onChange={(e) => setFiltros((p) => ({ ...p, fecha_hasta: e.target.value }))} />
      {renderSelect('Categoría', filtros.categoria_id, categorias, (v) => setFiltros((p) => ({ ...p, categoria_id: v })))}
      {renderSelect('Persona', filtros.persona_id, personas.map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido ?? ''}`.trim() })), (v) => setFiltros((p) => ({ ...p, persona_id: v })))}
      {renderSelect('Medio de pago', filtros.medio_pago_id, mediosPago, (v) => setFiltros((p) => ({ ...p, medio_pago_id: v })))}
      {renderSelect('Cuenta de tarjeta', filtros.cuenta_tarjeta_id, cuentasTarjeta.map((c) => ({ id: c.id, nombre: c.nombre_cuenta })), (v) => setFiltros((p) => ({ ...p, cuenta_tarjeta_id: v })))}
      {renderSelect('Tarjeta física', filtros.tarjeta_fisica_id, tarjetasFisicas.map((t) => ({ id: t.id, nombre: tarjetasEtiquetas.get(t.id) ?? 'Tarjeta' })), (v) => setFiltros((p) => ({ ...p, tarjeta_fisica_id: v })))}
      <select value={filtros.estado_registro} onChange={(e) => setFiltros((p) => ({ ...p, estado_registro: e.target.value as Filtros['estado_registro'] }))} className="rounded-xl border px-3 py-2 text-sm"><option value="activos">Activos / confirmados</option><option value="anulados">Anulados</option><option value="todos">Todos</option></select>
    </div>

    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
      <div className="rounded-xl border bg-white p-3 text-sm">Gastos encontrados: <strong>{gastosFiltrados.length}</strong></div>
      <div className="rounded-xl border bg-white p-3 text-sm">Total operativo: <strong>${totalOperativo.toFixed(2)}</strong></div>
      <div className="rounded-xl border bg-white p-3 text-sm">Total anulado: <strong>${totalAnulado.toFixed(2)}</strong></div>
    </div>

    <div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-sm"><tbody>{gastosFiltrados.map((gasto) => <tr key={gasto.id} className={`border-t ${gasto.estado_registro === 'anulado' ? 'text-slate-400' : ''}`}><td className="px-2 py-2">{gasto.fecha_gasto}</td><td className="px-2">{gasto.establecimiento}</td><td className="px-2">{nombresCategoria.get(gasto.categoria_id)}</td><td className="px-2">{nombresPersona.get(gasto.persona_id)}</td><td className="px-2">{nombresMedioPago.get(gasto.medio_pago_id)}</td><td className="px-2">{cuotasPorGasto.get(gasto.id) ?? gasto.cantidad_cuotas}</td><td className="px-2">{gasto.estado_registro === 'anulado' ? <span className="rounded bg-rose-100 px-2 py-1 text-xs text-rose-700">Anulado</span> : null}</td><td className="px-2"><button onClick={() => setGastoEditando(gasto)} className="rounded border px-2 py-1">Editar</button>{gasto.estado_registro !== 'anulado' ? <button onClick={() => void anularGasto(gasto)} className="ml-2 rounded border border-rose-200 px-2 py-1 text-rose-700">Anular</button> : null}</td></tr>)}</tbody></table></div>

    {gastoEditando && <form onSubmit={guardarEdicion} className="space-y-2 rounded-2xl border bg-white p-4">
      <h2 className="font-semibold">Editar gasto</h2>
      {cuotasGastoEditando.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Este gasto tiene cuotas generadas. Para corregir monto, fecha, medio de pago o cantidad de cuotas, anulá el gasto y cargalo nuevamente.</p>}
      <input type="date" disabled={cuotasGastoEditando.length > 0} value={gastoEditando.fecha_gasto} onChange={(e) => setGastoEditando((p) => p ? { ...p, fecha_gasto: e.target.value } : null)} className="rounded-xl border px-3 py-2" />
      <input value={gastoEditando.establecimiento} onChange={(e) => setGastoEditando((p) => p ? { ...p, establecimiento: e.target.value } : null)} className="rounded-xl border px-3 py-2" />
      {renderSelect('Categoría', gastoEditando.categoria_id, categorias, (v) => setGastoEditando((p) => p ? { ...p, categoria_id: v } : null))}
      {renderSelect('Persona', gastoEditando.persona_id, personas.map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido ?? ''}`.trim() })), (v) => setGastoEditando((p) => p ? { ...p, persona_id: v } : null))}
      {renderSelect('Medio de pago', gastoEditando.medio_pago_id, mediosPago, (v) => setGastoEditando((p) => {
        if (!p) return null;
        const medioEsTarjeta = esMedioTarjetaCredito(v);
        return { ...p, medio_pago_id: v, cuenta_tarjeta_id: medioEsTarjeta ? p.cuenta_tarjeta_id : null, tarjeta_fisica_id: medioEsTarjeta ? p.tarjeta_fisica_id : null, cantidad_cuotas: medioEsTarjeta ? p.cantidad_cuotas : 1 };
      }), gastoEditandoTieneCuotas)}
      {gastoEditandoEsTarjeta ? (
        <>
          {renderSelect('Cuenta de tarjeta', gastoEditando.cuenta_tarjeta_id ?? '', cuentasTarjeta.map((c) => ({ id: c.id, nombre: c.nombre_cuenta })), (v) => setGastoEditando((p) => p ? { ...p, cuenta_tarjeta_id: v || null, tarjeta_fisica_id: null } : null), gastoEditandoTieneCuotas)}
          {renderSelect('Tarjeta física', gastoEditando.tarjeta_fisica_id ?? '', tarjetasDisponiblesEdicion, (v) => setGastoEditando((p) => p ? { ...p, tarjeta_fisica_id: v || null } : null))}
        </>
      ) : null}
      <input type="number" disabled={cuotasGastoEditando.length > 0} value={gastoEditando.monto} onChange={(e) => setGastoEditando((p) => p ? { ...p, monto: Number(e.target.value) } : null)} className="rounded-xl border px-3 py-2" />
      <textarea value={gastoEditando.descripcion ?? ''} onChange={(e) => setGastoEditando((p) => p ? { ...p, descripcion: e.target.value } : null)} className="rounded-xl border px-3 py-2" />
      <textarea value={gastoEditando.observaciones ?? ''} onChange={(e) => setGastoEditando((p) => p ? { ...p, observaciones: e.target.value } : null)} className="rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-emerald-600 px-3 py-2 text-white">Guardar cambios</button>

      <div className="space-y-2 border-t pt-3"><h3 className="font-medium">Cuotas asociadas</h3>
        {cuotasGastoEditando.map((cuota) => <div key={cuota.id} className="rounded-xl border p-2 text-sm">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs md:grid-cols-3">
            <p><strong>Cuota:</strong> {cuota.numero_cuota}/{cuota.total_cuotas}</p>
            <p><strong>Monto:</strong> ${cuota.monto_cuota.toFixed(2)}</p>
            <p><strong>Estado:</strong> {cuota.estado}</p>
            <p><strong>Origen:</strong> {cuota.origen_cuota}</p>
          </div>
          {ESTADOS_EDITABLES_CUOTA.has(cuota.estado) ? <div className="mt-2 grid gap-2 md:grid-cols-2">
            <input value={cuota.periodo_pago_estimado} onChange={(e) => setCuotas((prev) => prev.map((item) => item.id === cuota.id ? { ...item, periodo_pago_estimado: e.target.value } : item))} className="rounded border px-2 py-1 text-xs" />
            <input value={cuota.observaciones ?? ''} onChange={(e) => setCuotas((prev) => prev.map((item) => item.id === cuota.id ? { ...item, observaciones: e.target.value } : item))} className="rounded border px-2 py-1 text-xs" placeholder="Observaciones" />
            <button type="button" onClick={() => void actualizarCuotaAsociada(cuota, { periodo_pago_estimado: cuota.periodo_pago_estimado, observaciones: cuota.observaciones ?? null })} className="rounded bg-emerald-600 px-2 py-1 text-xs text-white md:col-span-2">Guardar cuota</button>
          </div> : <p className="mt-2 text-xs text-slate-500">No editable (pagada/cancelada).</p>}
        </div>)}
      </div>
    </form>}
  </section>;
}

function renderSelect(label: string, value: string, options: OpcionBase[], onChange: (value: string) => void, disabled = false) {
  return <select aria-label={label} disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"><option value="">{label}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)}</select>;
}
