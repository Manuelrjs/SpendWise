'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { sumarMesesPeriodo } from '@/utils/tarjetas';

type CuentaTarjeta = { id: string; nombre_cuenta: string; banco: string | null; marca: string | null };
type TarjetaFisica = { id: string; cuenta_tarjeta_id: string; persona_id: string; alias: string | null; tipo: string; ultimos_4_digitos: string | null };
type Persona = { id: string; nombre: string; apellido: string | null };
type Categoria = { id: string; nombre: string };
type CompraInicial = { id: string; establecimiento: string | null; descripcion_compra: string | null; cuenta_tarjeta_id: string; tarjeta_fisica_id: string | null; persona_id: string; cuota_inicio_pendiente: number; total_cuotas: number; monto_cuota: number; moneda: string; periodo_inicio_pago: string; estado: string };
type CuotaGenerada = { id: string; compra_cuota_inicial_id: string; numero_cuota: number; total_cuotas: number; periodo_pago_estimado: string; monto_cuota: number; moneda: string; estado: string };
type Formulario = { fecha_compra_original: string; establecimiento: string; descripcion_compra: string; cuenta_tarjeta_id: string; tarjeta_fisica_id: string; persona_id: string; cuota_inicio_pendiente: number; total_cuotas: number; monto_cuota: string; moneda: string; periodo_inicio_pago: string; categoria_id: string; observaciones: string };

const FORMATO_PERIODO = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const inicial: Formulario = { fecha_compra_original: '', establecimiento: '', descripcion_compra: '', cuenta_tarjeta_id: '', tarjeta_fisica_id: '', persona_id: '', cuota_inicio_pendiente: 1, total_cuotas: 1, monto_cuota: '', moneda: 'ARS', periodo_inicio_pago: '', categoria_id: '', observaciones: '' };

export default function Page() {
  const [formulario, setFormulario] = useState<Formulario>(inicial);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [compras, setCompras] = useState<CompraInicial[]>([]);
  const [cuotasPorCompra, setCuotasPorCompra] = useState<Record<string, CuotaGenerada[]>>({});
  const [compraExpandida, setCompraExpandida] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const tarjetasFiltradas = useMemo(() => tarjetas.filter((tarjeta) => tarjeta.cuenta_tarjeta_id === formulario.cuenta_tarjeta_id), [tarjetas, formulario.cuenta_tarjeta_id]);
  const vistaPrevia = useMemo(() => {
    if (!FORMATO_PERIODO.test(formulario.periodo_inicio_pago)) return [];
    if (formulario.cuota_inicio_pendiente > formulario.total_cuotas) return [];
    const monto = Number(formulario.monto_cuota);
    if (!(monto > 0)) return [];
    return Array.from({ length: formulario.total_cuotas - formulario.cuota_inicio_pendiente + 1 }, (_, idx) => ({
      numero: formulario.cuota_inicio_pendiente + idx,
      periodo: sumarMesesPeriodo(formulario.periodo_inicio_pago, idx),
      monto,
    }));
  }, [formulario]);

  useEffect(() => { void cargarDatos(); }, []);

  async function cargarDatos() {
    const [ct, tf, p, c, ci] = await Promise.all([
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta,banco,marca').eq('activo', true).order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,cuenta_tarjeta_id,persona_id,alias,tipo,ultimos_4_digitos').eq('activo', true),
      supabase.from('personas').select('id,nombre,apellido').eq('activo', true).order('nombre'),
      supabase.from('categorias').select('id,nombre').eq('activo', true).order('nombre'),
      supabase.from('compras_cuotas_iniciales').select('id,establecimiento,descripcion_compra,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,cuota_inicio_pendiente,total_cuotas,monto_cuota,moneda,periodo_inicio_pago,estado').order('creado_en', { ascending: false }),
    ]);
    if (ct.error || tf.error || p.error || c.error || ci.error) return setError('No se pudieron cargar los datos de cuotas iniciales.');
    setCuentas((ct.data ?? []) as CuentaTarjeta[]);
    setTarjetas((tf.data ?? []) as TarjetaFisica[]);
    setPersonas((p.data ?? []) as Persona[]);
    setCategorias((c.data ?? []) as Categoria[]);
    setCompras((ci.data ?? []) as CompraInicial[]);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setError(null); setMensaje(null);
    if (!formulario.establecimiento.trim()) return setError('El establecimiento es obligatorio.');
    if (!formulario.cuenta_tarjeta_id) return setError('La cuenta de tarjeta es obligatoria.');
    if (!formulario.persona_id) return setError('La persona es obligatoria.');
    if (!FORMATO_PERIODO.test(formulario.periodo_inicio_pago)) return setError('El período inicial debe tener formato YYYY-MM.');
    if (formulario.cuota_inicio_pendiente < 1 || formulario.total_cuotas < 1) return setError('Las cuotas deben ser mayores o iguales a 1.');
    if (formulario.cuota_inicio_pendiente > formulario.total_cuotas) return setError('La cuota inicial pendiente no puede superar al total de cuotas.');
    const monto = Number(formulario.monto_cuota);
    if (!(monto > 0)) return setError('El monto por cuota debe ser mayor a 0.');

    setGuardando(true);
    try {
      const { data: compra, error: errorCompra } = await supabase.from('compras_cuotas_iniciales').insert({ fecha_compra_original: formulario.fecha_compra_original || null, establecimiento: formulario.establecimiento.trim(), descripcion_compra: formulario.descripcion_compra.trim() || null, cuenta_tarjeta_id: formulario.cuenta_tarjeta_id, tarjeta_fisica_id: formulario.tarjeta_fisica_id || null, persona_id: formulario.persona_id, cuota_inicio_pendiente: formulario.cuota_inicio_pendiente, total_cuotas: formulario.total_cuotas, monto_cuota: monto, moneda: formulario.moneda, periodo_inicio_pago: formulario.periodo_inicio_pago, categoria_id: formulario.categoria_id || null, observaciones: formulario.observaciones.trim() || null, estado: 'activa' }).select('id').single();
      if (errorCompra || !compra) throw new Error('No se pudo guardar la compra de cuotas iniciales.');

      const cuotas = Array.from({ length: formulario.total_cuotas - formulario.cuota_inicio_pendiente + 1 }, (_, idx) => ({
        compra_cuota_inicial_id: compra.id, gasto_id: null, cuenta_tarjeta_id: formulario.cuenta_tarjeta_id, tarjeta_fisica_id: formulario.tarjeta_fisica_id || null, persona_id: formulario.persona_id, establecimiento: formulario.establecimiento.trim(), descripcion_cuota: formulario.descripcion_compra.trim() || formulario.establecimiento.trim(), numero_cuota: formulario.cuota_inicio_pendiente + idx, total_cuotas: formulario.total_cuotas, monto_cuota: monto, moneda: formulario.moneda, periodo_pago_estimado: sumarMesesPeriodo(formulario.periodo_inicio_pago, idx), estado: 'pendiente', origen_cuota: 'carga_inicial', observaciones: formulario.observaciones.trim() || null,
      }));
      const { error: errorCuotas } = await supabase.from('cuotas_tarjeta').insert(cuotas);
      if (errorCuotas) throw new Error('Se guardó la compra inicial, pero falló la generación de cuotas.');

      setFormulario(inicial);
      setMensaje('Carga inicial guardada y cuotas generadas.');
      await cargarDatos();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado al guardar.');
    } finally { setGuardando(false); }
  }

  async function verCuotas(compraId: string) {
    if (cuotasPorCompra[compraId]) return setCompraExpandida((prev) => (prev === compraId ? null : compraId));
    const { data, error: err } = await supabase.from('cuotas_tarjeta').select('id,compra_cuota_inicial_id,numero_cuota,total_cuotas,periodo_pago_estimado,monto_cuota,moneda,estado').eq('compra_cuota_inicial_id', compraId).order('numero_cuota');
    if (err) return setError('No se pudieron consultar las cuotas generadas.');
    setCuotasPorCompra((prev) => ({ ...prev, [compraId]: (data ?? []) as CuotaGenerada[] }));
    setCompraExpandida(compraId);
  }

  async function anular(compraId: string) {
    const { error: errCompra } = await supabase.from('compras_cuotas_iniciales').update({ estado: 'anulada' }).eq('id', compraId);
    if (errCompra) return setError('No se pudo anular la carga inicial.');
    const { error: errCuotas } = await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada' }).eq('compra_cuota_inicial_id', compraId).neq('estado', 'pagada');
    if (errCuotas) return setError('No se pudieron cancelar las cuotas pendientes asociadas.');
    setMensaje('Carga inicial anulada correctamente.');
    await cargarDatos();
  }

  return <section className="mx-auto max-w-6xl space-y-4"><h1 className="text-2xl font-semibold">Cuotas iniciales</h1><p className="text-sm text-slate-600">Cargá compras anteriores con cuotas pendientes sin registrar el gasto histórico completo.</p>{error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}{mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{mensaje}</p>}<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">Importar desde Excel/CSV próximamente (aún no disponible).</div><div className="grid gap-4 lg:grid-cols-2"><form onSubmit={guardar} className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-semibold">Nueva carga manual</h2><input value={formulario.monto_cuota} onChange={(e) => setFormulario((p) => ({ ...p, monto_cuota: e.target.value }))} placeholder="Monto por cuota *" className="w-full rounded-xl border px-3 py-3 text-xl font-semibold" /><div className="grid gap-2 sm:grid-cols-2"><input type="date" value={formulario.fecha_compra_original} onChange={(e) => setFormulario((p) => ({ ...p, fecha_compra_original: e.target.value }))} className="rounded-xl border px-3 py-2" /><input value={formulario.periodo_inicio_pago} onChange={(e) => setFormulario((p) => ({ ...p, periodo_inicio_pago: e.target.value }))} placeholder="Período inicio YYYY-MM *" className="rounded-xl border px-3 py-2" /></div><input value={formulario.establecimiento} onChange={(e) => setFormulario((p) => ({ ...p, establecimiento: e.target.value }))} placeholder="Establecimiento *" className="w-full rounded-xl border px-3 py-2" /><input value={formulario.descripcion_compra} onChange={(e) => setFormulario((p) => ({ ...p, descripcion_compra: e.target.value }))} placeholder="Descripción compra" className="w-full rounded-xl border px-3 py-2" /><select value={formulario.cuenta_tarjeta_id} onChange={(e) => setFormulario((p) => ({ ...p, cuenta_tarjeta_id: e.target.value, tarjeta_fisica_id: '' }))} className="w-full rounded-xl border px-3 py-2"><option value="">Cuenta de tarjeta *</option>{cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre_cuenta}</option>)}</select><select value={formulario.tarjeta_fisica_id} onChange={(e) => { const id = e.target.value; const tarjeta = tarjetasFiltradas.find((t) => t.id === id); setFormulario((p) => ({ ...p, tarjeta_fisica_id: id, persona_id: tarjeta?.persona_id ?? p.persona_id })); }} className="w-full rounded-xl border px-3 py-2"><option value="">Tarjeta física (opcional)</option>{tarjetasFiltradas.map((tarjeta) => <option key={tarjeta.id} value={tarjeta.id}>{tarjeta.alias ?? tarjeta.tipo}{tarjeta.ultimos_4_digitos ? ` • ${tarjeta.ultimos_4_digitos}` : ''}</option>)}</select><select value={formulario.persona_id} onChange={(e) => setFormulario((p) => ({ ...p, persona_id: e.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="">Persona *</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} {persona.apellido ?? ''}</option>)}</select><select value={formulario.categoria_id} onChange={(e) => setFormulario((p) => ({ ...p, categoria_id: e.target.value }))} className="w-full rounded-xl border px-3 py-2"><option value="">Categoría</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select><div className="grid gap-2 sm:grid-cols-3"><input type="number" min={1} value={formulario.cuota_inicio_pendiente} onChange={(e) => setFormulario((p) => ({ ...p, cuota_inicio_pendiente: Number(e.target.value) || 1 }))} className="rounded-xl border px-3 py-2" /><input type="number" min={1} value={formulario.total_cuotas} onChange={(e) => setFormulario((p) => ({ ...p, total_cuotas: Number(e.target.value) || 1 }))} className="rounded-xl border px-3 py-2" /><input value={formulario.moneda} onChange={(e) => setFormulario((p) => ({ ...p, moneda: e.target.value }))} className="rounded-xl border px-3 py-2" /></div><textarea value={formulario.observaciones} onChange={(e) => setFormulario((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Observaciones" className="w-full rounded-xl border px-3 py-2" /><button disabled={guardando} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">{guardando ? 'Guardando...' : 'Guardar carga inicial'}</button></form><div className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="font-semibold">Vista previa</h2>{vistaPrevia.length === 0 ? <p className="mt-2 text-sm text-slate-500">Completá los campos requeridos para ver las cuotas que se generarán.</p> : <ul className="mt-2 space-y-2">{vistaPrevia.map((fila) => <li key={fila.numero} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">{fila.numero}/{formulario.total_cuotas} · {fila.periodo} · {new Intl.NumberFormat('es-AR', { style: 'currency', currency: formulario.moneda || 'ARS' }).format(fila.monto)}</li>)}</ul>}</div></div><div className="rounded-2xl border bg-white p-4 shadow-sm"><h2 className="mb-3 font-semibold">Cargas iniciales registradas</h2><div className="space-y-3">{compras.map((compra) => <article key={compra.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{compra.establecimiento ?? 'Sin establecimiento'}</p><p className="text-sm text-slate-600">{compra.descripcion_compra ?? 'Sin descripción'}</p><p className="text-xs text-slate-500">Cuota pendiente: {compra.cuota_inicio_pendiente} · Total: {compra.total_cuotas} · Inicio: {compra.periodo_inicio_pago} · Estado: {compra.estado}</p></div><p className="font-semibold">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: compra.moneda }).format(compra.monto_cuota)}</p></div><div className="mt-2 flex gap-2"><button onClick={() => void verCuotas(compra.id)} className="rounded-lg border px-2 py-1 text-xs">Ver cuotas generadas</button><button onClick={() => void anular(compra.id)} disabled={compra.estado === 'anulada'} className="rounded-lg border border-rose-200 px-2 py-1 text-xs text-rose-700 disabled:opacity-50">Anular carga inicial</button></div>{compraExpandida === compra.id && cuotasPorCompra[compra.id] && <ul className="mt-2 space-y-1">{cuotasPorCompra[compra.id].map((cuota) => <li key={cuota.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">{cuota.numero_cuota}/{cuota.total_cuotas} · {cuota.periodo_pago_estimado} · {new Intl.NumberFormat('es-AR', { style: 'currency', currency: cuota.moneda }).format(cuota.monto_cuota)} · {cuota.estado}</li>)}</ul>}</article>)}{compras.length === 0 && <p className="text-sm text-slate-500">Todavía no hay cargas iniciales.</p>}</div></div></section>;
}
