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
  created_at: string;
};

type OpcionBase = { id: string; nombre: string };
type Persona = { id: string; nombre: string; apellido: string | null };
type CuentaTarjeta = { id: string; nombre_cuenta: string; banco: string | null; marca: string | null };
type TarjetaFisica = { id: string; alias: string | null; ultimos_4_digitos: string | null; tipo: string };
type CuotaRelacion = { gasto_id: string; total_cuotas: number };

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

const FILTROS_INICIALES: Filtros = {
  busqueda: '',
  fecha_desde: '',
  fecha_hasta: '',
  categoria_id: '',
  persona_id: '',
  medio_pago_id: '',
  cuenta_tarjeta_id: '',
  tarjeta_fisica_id: '',
  estado_registro: '',
};

export default function Page() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cuotas, setCuotas] = useState<CuotaRelacion[]>([]);
  const [categorias, setCategorias] = useState<OpcionBase[]>([]);
  const [mediosPago, setMediosPago] = useState<OpcionBase[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentasTarjeta, setCuentasTarjeta] = useState<CuentaTarjeta[]>([]);
  const [tarjetasFisicas, setTarjetasFisicas] = useState<TarjetaFisica[]>([]);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mostrandoFiltros, setMostrandoFiltros] = useState(false);
  const [gastoEditando, setGastoEditando] = useState<Gasto | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  useEffect(() => {
    void cargarDatos();
  }, []);

  const nombresCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nombre])), [categorias]);
  const nombresMedioPago = useMemo(() => new Map(mediosPago.map((m) => [m.id, m.nombre])), [mediosPago]);
  const nombresPersona = useMemo(() => new Map(personas.map((p) => [p.id, `${p.nombre} ${p.apellido ?? ''}`.trim()])), [personas]);
  const nombresCuenta = useMemo(() => new Map(cuentasTarjeta.map((c) => [c.id, c.nombre_cuenta])), [cuentasTarjeta]);
  const nombresTarjeta = useMemo(
    () => new Map(tarjetasFisicas.map((t) => [t.id, `${t.alias ?? t.tipo}${t.ultimos_4_digitos ? ` • ${t.ultimos_4_digitos}` : ''}`])),
    [tarjetasFisicas],
  );
  const cuotasPorGasto = useMemo(() => new Map(cuotas.map((c) => [c.gasto_id, c.total_cuotas])), [cuotas]);

  const gastosFiltrados = useMemo(() => {
    const texto = filtros.busqueda.trim().toLowerCase();
    return gastos.filter((gasto) => {
      if (filtros.fecha_desde && gasto.fecha_gasto < filtros.fecha_desde) return false;
      if (filtros.fecha_hasta && gasto.fecha_gasto > filtros.fecha_hasta) return false;
      if (filtros.categoria_id && gasto.categoria_id !== filtros.categoria_id) return false;
      if (filtros.persona_id && gasto.persona_id !== filtros.persona_id) return false;
      if (filtros.medio_pago_id && gasto.medio_pago_id !== filtros.medio_pago_id) return false;
      if (filtros.cuenta_tarjeta_id && gasto.cuenta_tarjeta_id !== filtros.cuenta_tarjeta_id) return false;
      if (filtros.tarjeta_fisica_id && gasto.tarjeta_fisica_id !== filtros.tarjeta_fisica_id) return false;
      if (filtros.estado_registro && gasto.estado_registro !== filtros.estado_registro) return false;

      if (!texto) return true;
      const bolsa = [
        gasto.establecimiento,
        gasto.descripcion ?? '',
        gasto.observaciones ?? '',
        String(gasto.monto),
        nombresPersona.get(gasto.persona_id) ?? '',
        nombresCategoria.get(gasto.categoria_id) ?? '',
        gasto.cuenta_tarjeta_id ? nombresCuenta.get(gasto.cuenta_tarjeta_id) ?? '' : '',
        gasto.tarjeta_fisica_id ? nombresTarjeta.get(gasto.tarjeta_fisica_id) ?? '' : '',
      ]
        .join(' ')
        .toLowerCase();
      return bolsa.includes(texto);
    });
  }, [filtros, gastos, nombresCategoria, nombresCuenta, nombresPersona, nombresTarjeta]);

  const totalFiltrado = useMemo(() => gastosFiltrados.reduce((acc, gasto) => acc + gasto.monto, 0), [gastosFiltrados]);

  async function cargarDatos() {
    setCargando(true);
    setError(null);
    const [g, c, m, p, ct, tf, cuotasRes] = await Promise.all([
      supabase
        .from('gastos')
        .select('id,fecha_gasto,establecimiento,descripcion,observaciones,categoria_id,monto,moneda,medio_pago_id,persona_id,cuenta_tarjeta_id,tarjeta_fisica_id,cantidad_cuotas,estado_registro,created_at')
        .order('fecha_gasto', { ascending: false }),
      supabase.from('categorias').select('id,nombre').order('nombre'),
      supabase.from('medios_pago').select('id,nombre').order('nombre'),
      supabase.from('personas').select('id,nombre,apellido').order('nombre'),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta,banco,marca').order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,alias,ultimos_4_digitos,tipo').order('alias'),
      supabase.from('cuotas_tarjeta').select('gasto_id,total_cuotas'),
    ]);

    if (g.error || c.error || m.error || p.error || ct.error || tf.error || cuotasRes.error) {
      setError('No se pudieron cargar los gastos. Verificá la conexión con Supabase e intentá de nuevo.');
      setCargando(false);
      return;
    }

    setGastos((g.data ?? []) as Gasto[]);
    setCategorias((c.data ?? []) as OpcionBase[]);
    setMediosPago((m.data ?? []) as OpcionBase[]);
    setPersonas((p.data ?? []) as Persona[]);
    setCuentasTarjeta((ct.data ?? []) as CuentaTarjeta[]);
    setTarjetasFisicas((tf.data ?? []) as TarjetaFisica[]);
    setCuotas((cuotasRes.data ?? []) as CuotaRelacion[]);
    setCargando(false);
  }

  async function guardarEdicion(event: FormEvent) {
    event.preventDefault();
    if (!gastoEditando) return;
    setGuardandoEdicion(true);
    setError(null);

    const payload = {
      fecha_gasto: gastoEditando.fecha_gasto,
      establecimiento: gastoEditando.establecimiento.trim(),
      categoria_id: gastoEditando.categoria_id,
      persona_id: gastoEditando.persona_id,
      observaciones: gastoEditando.observaciones,
      descripcion: gastoEditando.descripcion,
      estado_registro: gastoEditando.estado_registro,
    };

    const { error: errorEdicion } = await supabase.from('gastos').update(payload).eq('id', gastoEditando.id);
    if (errorEdicion) {
      setError('No se pudo guardar la edición del gasto.');
      setGuardandoEdicion(false);
      return;
    }

    setGastos((prev) => prev.map((g) => (g.id === gastoEditando.id ? { ...g, ...payload } : g)));
    setGastoEditando(null);
    setGuardandoEdicion(false);
  }

  async function anularGasto(gastoId: string) {
    const { error: errorAnular } = await supabase.from('gastos').update({ estado_registro: 'anulado' }).eq('id', gastoId);
    if (errorAnular) {
      setError('No se pudo anular el gasto.');
      return;
    }

    setGastos((prev) => prev.map((gasto) => (gasto.id === gastoId ? { ...gasto, estado_registro: 'anulado' } : gasto)));
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Historial de gastos</h1>
          <p className="text-sm text-slate-600">Consultá, buscá y gestioná tus gastos de forma rápida.</p>
        </div>
        <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setMostrandoFiltros((v) => !v)}>
          {mostrandoFiltros ? 'Ocultar filtros avanzados' : 'Mostrar filtros avanzados'}
        </button>
      </header>

      <div className="rounded-2xl border bg-white p-3 shadow-sm">
        <input
          value={filtros.busqueda}
          onChange={(event) => setFiltros((prev) => ({ ...prev, busqueda: event.target.value }))}
          placeholder="Buscar por establecimiento, descripción, observaciones, persona, categoría o tarjeta"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />
        {mostrandoFiltros && (
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
            <input type="date" value={filtros.fecha_desde} onChange={(event) => setFiltros((prev) => ({ ...prev, fecha_desde: event.target.value }))} className="rounded-xl border px-3 py-2 text-sm" />
            <input type="date" value={filtros.fecha_hasta} onChange={(event) => setFiltros((prev) => ({ ...prev, fecha_hasta: event.target.value }))} className="rounded-xl border px-3 py-2 text-sm" />
            {renderSelect('Categoría', filtros.categoria_id, categorias, (valor) => setFiltros((prev) => ({ ...prev, categoria_id: valor })))}
            {renderSelect('Persona', filtros.persona_id, personas.map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido ?? ''}`.trim() })), (valor) => setFiltros((prev) => ({ ...prev, persona_id: valor })))}
            {renderSelect('Medio de pago', filtros.medio_pago_id, mediosPago, (valor) => setFiltros((prev) => ({ ...prev, medio_pago_id: valor })))}
            {renderSelect('Cuenta', filtros.cuenta_tarjeta_id, cuentasTarjeta.map((c) => ({ id: c.id, nombre: c.nombre_cuenta })), (valor) => setFiltros((prev) => ({ ...prev, cuenta_tarjeta_id: valor })))}
            {renderSelect('Tarjeta física', filtros.tarjeta_fisica_id, tarjetasFisicas.map((t) => ({ id: t.id, nombre: `${t.alias ?? t.tipo}${t.ultimos_4_digitos ? ` • ${t.ultimos_4_digitos}` : ''}` })), (valor) => setFiltros((prev) => ({ ...prev, tarjeta_fisica_id: valor })))}
            {renderSelect('Estado', filtros.estado_registro, [{ id: 'borrador', nombre: 'Borrador' }, { id: 'confirmado', nombre: 'Confirmado' }, { id: 'anulado', nombre: 'Anulado' }], (valor) => setFiltros((prev) => ({ ...prev, estado_registro: valor })))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-slate-50 p-3 text-sm">
        <span>Gastos encontrados: <strong>{gastosFiltrados.length}</strong></span>
        <span>Total filtrado: <strong>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totalFiltrado)}</strong></span>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {cargando && <p className="rounded-xl border bg-white px-3 py-2 text-sm">Cargando gastos...</p>}

      {!cargando && (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Establecimiento</th><th className="px-3 py-2">Categoría</th><th className="px-3 py-2">Monto</th><th className="px-3 py-2">Badges</th><th className="px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastosFiltrados.map((gasto) => <FilaGasto key={gasto.id} gasto={gasto} categoria={nombresCategoria.get(gasto.categoria_id) ?? 'Sin categoría'} medioPago={nombresMedioPago.get(gasto.medio_pago_id) ?? 'Sin medio'} persona={nombresPersona.get(gasto.persona_id) ?? 'Sin persona'} cuenta={gasto.cuenta_tarjeta_id ? nombresCuenta.get(gasto.cuenta_tarjeta_id) : null} tarjeta={gasto.tarjeta_fisica_id ? nombresTarjeta.get(gasto.tarjeta_fisica_id) : null} cuotas={cuotasPorGasto.get(gasto.id) ?? gasto.cantidad_cuotas} onEdit={() => setGastoEditando(gasto)} onAnular={() => void anularGasto(gasto.id)} />)}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {gastosFiltrados.map((gasto) => <CardGasto key={gasto.id} gasto={gasto} categoria={nombresCategoria.get(gasto.categoria_id) ?? 'Sin categoría'} medioPago={nombresMedioPago.get(gasto.medio_pago_id) ?? 'Sin medio'} persona={nombresPersona.get(gasto.persona_id) ?? 'Sin persona'} cuenta={gasto.cuenta_tarjeta_id ? nombresCuenta.get(gasto.cuenta_tarjeta_id) : null} tarjeta={gasto.tarjeta_fisica_id ? nombresTarjeta.get(gasto.tarjeta_fisica_id) : null} cuotas={cuotasPorGasto.get(gasto.id) ?? gasto.cantidad_cuotas} onEdit={() => setGastoEditando(gasto)} onAnular={() => void anularGasto(gasto.id)} />)}
          </div>
        </>
      )}

      {gastoEditando && (
        <form onSubmit={guardarEdicion} className="space-y-2 rounded-2xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Editar gasto</h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input type="date" value={gastoEditando.fecha_gasto} onChange={(event) => setGastoEditando((prev) => (prev ? { ...prev, fecha_gasto: event.target.value } : null))} className="rounded-xl border px-3 py-2" />
            <input value={gastoEditando.establecimiento} onChange={(event) => setGastoEditando((prev) => (prev ? { ...prev, establecimiento: event.target.value } : null))} className="rounded-xl border px-3 py-2" />
            {renderSelect('Categoría', gastoEditando.categoria_id, categorias, (valor) => setGastoEditando((prev) => (prev ? { ...prev, categoria_id: valor } : null)))}
            {renderSelect('Persona', gastoEditando.persona_id, personas.map((p) => ({ id: p.id, nombre: `${p.nombre} ${p.apellido ?? ''}`.trim() })), (valor) => setGastoEditando((prev) => (prev ? { ...prev, persona_id: valor } : null)))}
          </div>
          <textarea value={gastoEditando.descripcion ?? ''} onChange={(event) => setGastoEditando((prev) => (prev ? { ...prev, descripcion: event.target.value } : null))} className="w-full rounded-xl border px-3 py-2" placeholder="Descripción" />
          <textarea value={gastoEditando.observaciones ?? ''} onChange={(event) => setGastoEditando((prev) => (prev ? { ...prev, observaciones: event.target.value } : null))} className="w-full rounded-xl border px-3 py-2" placeholder="Observaciones" />
          <div className="flex gap-2"><button disabled={guardandoEdicion} className="rounded-xl bg-emerald-600 px-3 py-2 text-white">{guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}</button><button type="button" onClick={() => setGastoEditando(null)} className="rounded-xl border px-3 py-2">Cancelar</button></div>
          <p className="text-xs text-slate-500">La edición se limita a campos básicos del gasto. No se actualizan cuotas existentes en esta pantalla.</p>
        </form>
      )}
    </section>
  );
}

function renderSelect(label: string, value: string, options: OpcionBase[], onChange: (value: string) => void) {
  return <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border px-3 py-2 text-sm"><option value="">{label}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.nombre}</option>)}</select>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{children}</span>;
}

function FilaGasto({ gasto, categoria, medioPago, persona, cuenta, tarjeta, cuotas, onEdit, onAnular }: { gasto: Gasto; categoria: string; medioPago: string; persona: string; cuenta: string | null | undefined; tarjeta: string | null | undefined; cuotas: number; onEdit: () => void; onAnular: () => void }) {
  return <tr className="border-t align-top"><td className="px-3 py-2">{gasto.fecha_gasto}</td><td className="px-3 py-2"><p className="font-medium">{gasto.establecimiento}</p><p className="text-xs text-slate-500">{persona}</p></td><td className="px-3 py-2">{categoria}</td><td className="px-3 py-2">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: gasto.moneda }).format(gasto.monto)}</td><td className="space-x-1 px-3 py-2"><Badge>{medioPago}</Badge><Badge>{gasto.estado_registro}</Badge><Badge>{cuotas > 1 ? `${cuotas} cuotas` : '1 cuota'}</Badge>{cuenta && <Badge>{cuenta}</Badge>}{tarjeta && <Badge>{tarjeta}</Badge>}</td><td className="px-3 py-2"><div className="flex flex-col gap-1"><button onClick={onEdit} className="rounded-lg border px-2 py-1 text-xs">Editar</button><button onClick={onAnular} disabled={gasto.estado_registro === 'anulado'} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:opacity-50">Anular</button></div></td></tr>;
}

function CardGasto({ gasto, categoria, medioPago, persona, cuenta, tarjeta, cuotas, onEdit, onAnular }: { gasto: Gasto; categoria: string; medioPago: string; persona: string; cuenta: string | null | undefined; tarjeta: string | null | undefined; cuotas: number; onEdit: () => void; onAnular: () => void }) {
  return <article className="space-y-2 rounded-2xl border bg-white p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs text-slate-500">{gasto.fecha_gasto}</p><h3 className="font-semibold">{gasto.establecimiento}</h3><p className="text-sm text-slate-600">{categoria} · {persona}</p></div><p className="text-lg font-semibold">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: gasto.moneda }).format(gasto.monto)}</p></div><div className="flex flex-wrap gap-1"><Badge>{medioPago}</Badge><Badge>{gasto.estado_registro}</Badge><Badge>{cuotas > 1 ? `${cuotas} cuotas` : '1 cuota'}</Badge>{cuenta && <Badge>{cuenta}</Badge>}{tarjeta && <Badge>{tarjeta}</Badge>}</div><div className="flex gap-2"><button onClick={onEdit} className="rounded-lg border px-2 py-1 text-xs">Editar</button><button onClick={onAnular} disabled={gasto.estado_registro === 'anulado'} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:opacity-50">Anular</button></div></article>;
}
