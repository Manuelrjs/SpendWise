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
type TarjetaFisica = { id: string; alias: string | null; ultimos_4_digitos: string | null; tipo: string };
type CuotaTarjeta = {
  id: string;
  gasto_id: string;
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
  creado_en?: string;
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
  estado_registro: string;
};

type EdicionCuota = { id: string; periodo_pago_estimado: string; observaciones: string };

const ESTADOS_EDITABLES_CUOTA = new Set(['pendiente', 'proyectada', 'no_incluida', 'reprogramada']);
const ESTADOS_NO_EDITABLES_CUOTA = new Set(['pagada', 'cancelada']);

const FILTROS_INICIALES: Filtros = {
  busqueda: '', fecha_desde: '', fecha_hasta: '', categoria_id: '', persona_id: '', medio_pago_id: '', cuenta_tarjeta_id: '', tarjeta_fisica_id: '', estado_registro: '',
};

export default function Page() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cuotas, setCuotas] = useState<CuotaTarjeta[]>([]);
  const [categorias, setCategorias] = useState<OpcionBase[]>([]);
  const [mediosPago, setMediosPago] = useState<OpcionBase[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentasTarjeta, setCuentasTarjeta] = useState<CuentaTarjeta[]>([]);
  const [tarjetasFisicas, setTarjetasFisicas] = useState<TarjetaFisica[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [mostrandoFiltros, setMostrandoFiltros] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [edicionesCuotas, setEdicionesCuotas] = useState<Record<string, EdicionCuota>>({});

  useEffect(() => { void cargarDatos(); }, []);

  const nombresCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const nombresMedioPago = useMemo(() => new Map(mediosPago.map((m) => [m.id, m.nombre])), [mediosPago]);
  const nombresPersona = useMemo(() => new Map(personas.map((p) => [p.id, `${p.nombre} ${p.apellido ?? ''}`.trim()])), [personas]);
  const nombresCuenta = useMemo(() => new Map(cuentasTarjeta.map((c) => [c.id, c.nombre_cuenta])), [cuentasTarjeta]);
  const nombresTarjeta = useMemo(() => new Map(tarjetasFisicas.map((t) => [t.id, `${t.alias ?? t.tipo}${t.ultimos_4_digitos ? ` • ${t.ultimos_4_digitos}` : ''}`])), [tarjetasFisicas]);
  const cuotasPorGasto = useMemo(() => cuotas.reduce((acc, cuota) => acc.set(cuota.gasto_id, (acc.get(cuota.gasto_id) ?? 0) + 1), new Map<string, number>()), [cuotas]);
  const cuotasGastoEditando = useMemo(() => (gastoEditando ? cuotas.filter((c) => c.gasto_id === gastoEditando.id) : []), [cuotas, gastoEditando]);

  const gastosFiltrados = useMemo(() => gastos.filter((gasto) => {
    const texto = filtros.busqueda.trim().toLowerCase();
    if (filtros.fecha_desde && gasto.fecha_gasto < filtros.fecha_desde) return false;
    if (filtros.fecha_hasta && gasto.fecha_gasto > filtros.fecha_hasta) return false;
    if (filtros.categoria_id && gasto.categoria_id !== filtros.categoria_id) return false;
    if (filtros.persona_id && gasto.persona_id !== filtros.persona_id) return false;
    if (filtros.medio_pago_id && gasto.medio_pago_id !== filtros.medio_pago_id) return false;
    if (filtros.cuenta_tarjeta_id && gasto.cuenta_tarjeta_id !== filtros.cuenta_tarjeta_id) return false;
    if (filtros.tarjeta_fisica_id && gasto.tarjeta_fisica_id !== filtros.tarjeta_fisica_id) return false;
    if (filtros.estado_registro && gasto.estado_registro !== filtros.estado_registro) return false;
    if (!texto) return true;
    const bolsa = [gasto.establecimiento, gasto.descripcion ?? '', gasto.observaciones ?? '', String(gasto.monto), nombresPersona.get(gasto.persona_id) ?? '', nombresCategoria.get(gasto.categoria_id) ?? ''].join(' ').toLowerCase();
    return bolsa.includes(texto);
  }), [filtros, gastos, nombresCategoria, nombresPersona]);

  async function cargarDatos() {
    setCargando(true); setError(null);
    const [g, c, m, p, ct, tf, cuotasRes] = await Promise.all([
      supabase.from('gastos').select('id,fecha_gasto,establecimiento,descripcion,observaciones,categoria_id,monto,moneda,medio_pago_id,persona_id,cuenta_tarjeta_id,tarjeta_fisica_id,cantidad_cuotas,estado_registro,creado_en').order('fecha_gasto', { ascending: false }),
      supabase.from('categorias').select('id,nombre').order('nombre'),
      supabase.from('medios_pago').select('id,nombre').order('nombre'),
      supabase.from('personas').select('id,nombre,apellido').order('nombre'),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta').order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,alias,ultimos_4_digitos,tipo').order('alias'),
      supabase.from('cuotas_tarjeta').select('id,gasto_id,numero_cuota,total_cuotas,periodo_pago_estimado,monto_cuota,estado,origen_cuota,persona_id,tarjeta_fisica_id,cuenta_tarjeta_id,observaciones,creado_en')
    ]);
    if (g.error || c.error || m.error || p.error || ct.error || tf.error || cuotasRes.error) {
      console.error(g.error ?? c.error ?? m.error ?? p.error ?? ct.error ?? tf.error ?? cuotasRes.error);
      setError('No se pudieron cargar los gastos.');
      setCargando(false);
      return;
    }
    const cuotasOrdenadas = [ ...((cuotasRes.data ?? []) as CuotaTarjeta[]) ]
      .sort((a, b) => (a.gasto_id === b.gasto_id
        ? a.numero_cuota - b.numero_cuota
        : a.gasto_id.localeCompare(b.gasto_id)));

    setGastos((g.data ?? []) as Gasto[]); setCategorias((c.data ?? []) as OpcionBase[]); setMediosPago((m.data ?? []) as OpcionBase[]); setPersonas((p.data ?? []) as Persona[]); setCuentasTarjeta((ct.data ?? []) as CuentaTarjeta[]); setTarjetasFisicas((tf.data ?? []) as TarjetaFisica[]); setCuotas(cuotasOrdenadas); setCargando(false);
  }

  async function guardarEdicion(event: FormEvent) {
    event.preventDefault(); if (!gastoEditando) return;
    setError(null); setMensajeExito(null);
    const esTarjetaConCuotas = cuotasGastoEditando.length > 0;
    if (!gastoEditando.establecimiento.trim() || !gastoEditando.categoria_id || !gastoEditando.persona_id || (!esTarjetaConCuotas && (!gastoEditando.fecha_gasto || gastoEditando.monto <= 0))) {
      setError('Completá los campos obligatorios.'); return;
    }
    setGuardandoEdicion(true);

    const original = gastos.find((g) => g.id === gastoEditando.id);
    const cambiaCuenta = original?.cuenta_tarjeta_id !== gastoEditando.cuenta_tarjeta_id;
    const payloadBase = {
      establecimiento: gastoEditando.establecimiento.trim(), categoria_id: gastoEditando.categoria_id, persona_id: gastoEditando.persona_id,
      descripcion: gastoEditando.descripcion, observaciones: gastoEditando.observaciones, tarjeta_fisica_id: gastoEditando.tarjeta_fisica_id, cuenta_tarjeta_id: gastoEditando.cuenta_tarjeta_id,
      ...(esTarjetaConCuotas ? {} : { fecha_gasto: gastoEditando.fecha_gasto, monto: gastoEditando.monto, moneda: gastoEditando.moneda, medio_pago_id: gastoEditando.medio_pago_id }),
    };
    const { error: e1 } = await supabase.from('gastos').update(payloadBase).eq('id', gastoEditando.id);
    if (e1) { console.error(e1); setError('No se pudo guardar la edición.'); setGuardandoEdicion(false); return; }

    if (esTarjetaConCuotas) {
      const actualizarCuotas = async (cambios: Partial<CuotaTarjeta>) => supabase.from('cuotas_tarjeta').update(cambios).eq('gasto_id', gastoEditando.id).not('estado', 'in', '("pagada","cancelada")');
      if (original?.persona_id !== gastoEditando.persona_id) await actualizarCuotas({ persona_id: gastoEditando.persona_id });
      if (original?.tarjeta_fisica_id !== gastoEditando.tarjeta_fisica_id) await actualizarCuotas({ tarjeta_fisica_id: gastoEditando.tarjeta_fisica_id });
      if (cambiaCuenta) {
        const confirmar = window.confirm('Cambiar la cuenta puede afectar el flujo de pagos. ¿Querés actualizar también las cuotas no pagadas ni canceladas?');
        if (confirmar) await actualizarCuotas({ cuenta_tarjeta_id: gastoEditando.cuenta_tarjeta_id ?? '' });
      }
    }

    setMensajeExito('Gasto actualizado correctamente.');
    setGastoEditando(null);
    await cargarDatos();
    setGuardandoEdicion(false);
  }

  async function anularGasto(gasto: Gasto) {
    const texto = cuotas.some((c) => c.gasto_id === gasto.id)
      ? 'Se anulará el gasto y se cancelarán sus cuotas pendientes asociadas. Las cuotas pagadas no se modificarán.'
      : '¿Seguro que querés anular el gasto?';
    if (!window.confirm(texto)) return;
    setError(null); setMensajeExito(null);
    const { error: e1 } = await supabase.from('gastos').update({ estado_registro: 'anulado' }).eq('id', gasto.id);
    if (e1) { console.error(e1); return setError('No se pudo anular el gasto.'); }
    await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada' }).eq('gasto_id', gasto.id).neq('estado', 'pagada');
    setMensajeExito('Gasto anulado correctamente.');
    await cargarDatos();
  }

  async function reactivarGasto(gasto: Gasto) {
    const { error: e } = await supabase.from('gastos').update({ estado_registro: 'confirmado' }).eq('id', gasto.id);
    if (e) { console.error(e); return setError('No se pudo reactivar el gasto.'); }
    setMensajeExito('Gasto reactivado. Las cuotas asociadas permanecen canceladas. Revisalas manualmente.');
    await cargarDatos();
  }

  async function guardarCuota(cuota: CuotaTarjeta) {
    const edicion = edicionesCuotas[cuota.id]; if (!edicion) return;
    if (!/^\d{4}-\d{2}$/.test(edicion.periodo_pago_estimado)) return setError('El período debe tener formato YYYY-MM.');
    const estadoNuevo = cuota.estado === 'reprogramada' ? 'reprogramada' : 'reprogramada';
    const { error: e } = await supabase.from('cuotas_tarjeta').update({ periodo_pago_estimado: edicion.periodo_pago_estimado, observaciones: edicion.observaciones || null, estado: estadoNuevo }).eq('id', cuota.id);
    if (e) { console.error(e); return setError('No se pudo actualizar la cuota.'); }
    setMensajeExito('Se actualizó el período estimado de pago de la cuota.');
    await cargarDatos();
  }

  return <section className="space-y-4">{/* UI compacta */}
    <h1 className="text-2xl font-semibold">Historial de gastos</h1>
    {mensajeExito && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{mensajeExito}</p>}
    {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block"><table className="min-w-full text-sm"><tbody>{gastosFiltrados.length === 0 ? <tr><td className="px-2 py-6 text-center text-slate-500">Todavía no hay gastos registrados.</td></tr> : gastosFiltrados.map((gasto) => <FilaGasto key={gasto.id} gasto={gasto} categoria={nombresCategoria.get(gasto.categoria_id) ?? 'Sin categoría'} medioPago={nombresMedioPago.get(gasto.medio_pago_id) ?? 'Sin medio'} persona={nombresPersona.get(gasto.persona_id) ?? 'Sin persona'} cuotas={cuotasPorGasto.get(gasto.id) ?? gasto.cantidad_cuotas} onEdit={() => setGastoEditando(gasto)} onAnular={() => void anularGasto(gasto)} onReactivar={() => void reactivarGasto(gasto)} />)}</tbody></table></div>

    {gastoEditando && <form onSubmit={guardarEdicion} className="space-y-2 rounded-2xl border bg-white p-4">
      <h2 className="font-semibold">Editar gasto</h2>
      {cuotasGastoEditando.length > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">Este gasto tiene cuotas generadas. Para corregir monto, fecha, medio de pago o cantidad de cuotas, anulá el gasto y cargalo nuevamente.</p>}
      <input type="date" disabled={cuotasGastoEditando.length > 0} value={gastoEditando.fecha_gasto} onChange={(e) => setGastoEditando((p) => p ? { ...p, fecha_gasto: e.target.value } : null)} className="rounded-xl border px-3 py-2" />
      <input value={gastoEditando.establecimiento} onChange={(e) => setGastoEditando((p) => p ? { ...p, establecimiento: e.target.value } : null)} className="rounded-xl border px-3 py-2" />
      {renderSelect('Categoría', gastoEditando.categoria_id, categorias, (v) => setGastoEditando((p) => p ? { ...p, categoria_id: v } : null))}
      {renderSelect('Persona', gastoEditando.persona_id, personas.map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido ?? ''}`.trim() })), (v) => setGastoEditando((p) => p ? { ...p, persona_id: v } : null))}
      {renderSelect('Cuenta de tarjeta', gastoEditando.cuenta_tarjeta_id ?? '', cuentasTarjeta.map((c) => ({ id: c.id, nombre: c.nombre_cuenta })), (v) => setGastoEditando((p) => p ? { ...p, cuenta_tarjeta_id: v || null } : null))}
      {renderSelect('Tarjeta física', gastoEditando.tarjeta_fisica_id ?? '', tarjetasFisicas.map((t) => ({ id: t.id, nombre: `${t.alias ?? t.tipo}${t.ultimos_4_digitos ? ` • ${t.ultimos_4_digitos}` : ''}` })), (v) => setGastoEditando((p) => p ? { ...p, tarjeta_fisica_id: v || null } : null))}
      <input type="number" disabled={cuotasGastoEditando.length > 0} value={gastoEditando.monto} onChange={(e) => setGastoEditando((p) => p ? { ...p, monto: Number(e.target.value) } : null)} className="rounded-xl border px-3 py-2" />
      {renderSelect('Medio de pago', gastoEditando.medio_pago_id, mediosPago, (v) => setGastoEditando((p) => p ? { ...p, medio_pago_id: v } : null))}
      <textarea value={gastoEditando.observaciones ?? ''} onChange={(e) => setGastoEditando((p) => p ? { ...p, observaciones: e.target.value } : null)} className="rounded-xl border px-3 py-2" placeholder="Observaciones" />
      <button className="rounded-xl bg-emerald-600 px-3 py-2 text-white">{guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}</button>

      <div className="space-y-2 border-t pt-3"><h3 className="font-medium">Cuotas asociadas</h3>
        {cuotasGastoEditando.map((cuota) => {
          const editable = ESTADOS_EDITABLES_CUOTA.has(cuota.estado);
          const ed = edicionesCuotas[cuota.id] ?? { id: cuota.id, periodo_pago_estimado: cuota.periodo_pago_estimado, observaciones: cuota.observaciones ?? '' };
          return <div key={cuota.id} className="rounded-xl border p-2 text-sm"><p>{cuota.numero_cuota}/{cuota.total_cuotas} · {cuota.estado} · {cuota.origen_cuota}</p>
            <input disabled={!editable} value={ed.periodo_pago_estimado} onChange={(e) => setEdicionesCuotas((p) => ({ ...p, [cuota.id]: { ...ed, periodo_pago_estimado: e.target.value } }))} className="mt-1 rounded border px-2 py-1" />
            <textarea disabled={!editable} value={ed.observaciones} onChange={(e) => setEdicionesCuotas((p) => ({ ...p, [cuota.id]: { ...ed, observaciones: e.target.value } }))} className="mt-1 w-full rounded border px-2 py-1" />
            {ESTADOS_NO_EDITABLES_CUOTA.has(cuota.estado) ? <p className="text-xs text-slate-500">Cuota no editable por su estado.</p> : <button type="button" onClick={() => void guardarCuota(cuota)} className="mt-1 rounded border px-2 py-1 text-xs">Guardar cuota</button>}
          </div>;
        })}
      </div>
    </form>}
  </section>;
}

function renderSelect(label: string, value: string, options: OpcionBase[], onChange: (value: string) => void) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="">{label}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)}</select>;
}

function FilaGasto({ gasto, categoria, medioPago, persona, cuotas, onEdit, onAnular, onReactivar }: { gasto: Gasto; categoria: string; medioPago: string; persona: string; cuotas: number; onEdit: () => void; onAnular: () => void; onReactivar: () => void }) {
  return <tr className="border-t"><td className="px-2 py-2">{gasto.fecha_gasto}</td><td className="px-2">{gasto.establecimiento}</td><td className="px-2">{categoria}</td><td className="px-2">{persona}</td><td className="px-2">{medioPago}</td><td className="px-2">{cuotas}</td><td className="px-2"><button onClick={onEdit} className="mr-2 rounded border px-2 py-1">Editar</button>{gasto.estado_registro === 'anulado' ? <button onClick={onReactivar} className="rounded border border-emerald-200 px-2 py-1 text-emerald-700">Reactivar</button> : <button onClick={onAnular} className="rounded border border-rose-200 px-2 py-1 text-rose-700">Anular gasto</button>}</td></tr>;
}
