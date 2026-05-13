'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  calcularPeriodoTarjeta,
  CalendarioTarjeta,
  construirFechaCierreEstimada,
  construirFechaVencimientoEstimada,
  formatearPeriodoDesdeFecha,
  sumarMesesPeriodo,
} from '@/utils/tarjetas';

type MedioPago = { id: string; nombre: string; tipo: string; activo: boolean; orden: number | null };
type Categoria = { id: string; nombre: string; icono: string | null; color: string | null; activo: boolean; orden: number | null };
type Persona = { id: string; nombre: string; apellido: string | null; activo: boolean };
type CuentaTarjeta = { id: string; nombre_cuenta: string; banco: string | null; marca: string | null; dia_cierre_habitual: number | null; dias_hasta_vencimiento: number | null; activo: boolean };
type TarjetaFisica = { id: string; cuenta_tarjeta_id: string; persona_id: string; alias: string | null; tipo: string; ultimos_4_digitos: string | null; activo: boolean };

type Formulario = {
  monto: string; moneda: string; medio_pago_id: string; cuenta_tarjeta_id: string; tarjeta_fisica_id: string; fecha_gasto: string;
  establecimiento: string; categoria_id: string; persona_id: string; cantidad_cuotas: number; descripcion: string; observaciones: string;
};

const HOY = new Date().toISOString().slice(0, 10);
const inicial: Formulario = { monto: '', moneda: 'ARS', medio_pago_id: '', cuenta_tarjeta_id: '', tarjeta_fisica_id: '', fecha_gasto: HOY, establecimiento: '', categoria_id: '', persona_id: '', cantidad_cuotas: 1, descripcion: '', observaciones: '' };

export default function Page() {
  const [formulario, setFormulario] = useState<Formulario>(inicial);
  const [medios, setMedios] = useState<MedioPago[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [calendarios, setCalendarios] = useState<CalendarioTarjeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);

  const medioSeleccionado = useMemo(() => medios.find((medio) => medio.id === formulario.medio_pago_id), [medios, formulario.medio_pago_id]);
  const esTarjetaCredito = medioSeleccionado?.tipo === 'tarjeta_credito';
  const tarjetasCuenta = useMemo(() => tarjetas.filter((t) => t.cuenta_tarjeta_id === formulario.cuenta_tarjeta_id), [tarjetas, formulario.cuenta_tarjeta_id]);

  useEffect(() => { void cargarDatos(); }, []);
  useEffect(() => {
    if (!esTarjetaCredito) {
      setFormulario((prev) => ({ ...prev, cuenta_tarjeta_id: '', tarjeta_fisica_id: '', cantidad_cuotas: 1 }));
    }
  }, [esTarjetaCredito]);

  async function cargarDatos() {
    const [m, c, p, ct, tf, cal] = await Promise.all([
      supabase.from('medios_pago').select('id,nombre,tipo,activo,orden').eq('activo', true).order('orden'),
      supabase.from('categorias').select('id,nombre,icono,color,activo,orden').eq('activo', true).order('orden'),
      supabase.from('personas').select('id,nombre,apellido,activo').eq('activo', true).order('nombre'),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta,banco,marca,dia_cierre_habitual,dias_hasta_vencimiento,activo').eq('activo', true).order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,cuenta_tarjeta_id,persona_id,alias,tipo,ultimos_4_digitos,activo').eq('activo', true),
      supabase.from('calendario_tarjetas').select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones'),
    ]);
    if ([m,c,p,ct,tf,cal].some((r) => r.error)) return setError('No se pudieron cargar los datos iniciales.');
    setMedios(m.data ?? []); setCategorias(c.data ?? []); setPersonas(p.data ?? []); setCuentas(ct.data ?? []); setTarjetas(tf.data ?? []); setCalendarios((cal.data ?? []) as CalendarioTarjeta[]);
  }

  async function asegurarCalendario(cuenta: CuentaTarjeta, periodo: string) {
    const existente = calendarios.find((cal) => cal.cuenta_tarjeta_id === cuenta.id && cal.periodo_resumen === periodo);
    if (existente) return { calendario: existente, generado: false };
    if (!cuenta.dia_cierre_habitual || cuenta.dias_hasta_vencimiento === null) throw new Error('Esta cuenta no tiene configuración habitual de cierre/vencimiento. Completala en Tarjetas o cargá el calendario manualmente.');
    const fecha_cierre = construirFechaCierreEstimada(periodo, cuenta.dia_cierre_habitual);
    const fecha_vencimiento = construirFechaVencimientoEstimada(fecha_cierre, cuenta.dias_hasta_vencimiento);
    const payload = { cuenta_tarjeta_id: cuenta.id, periodo_resumen: periodo, fecha_cierre, fecha_vencimiento, estado_calendario: 'estimado', origen_fecha: 'calculado', observaciones: 'Calendario generado automáticamente al registrar un gasto.' };
    const { data, error: err } = await supabase.from('calendario_tarjetas').insert(payload).select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones').single();
    if (err) throw new Error('No se pudo generar el calendario estimado automáticamente.');
    const nuevo = data as CalendarioTarjeta;
    setCalendarios((prev) => [...prev, nuevo]);
    return { calendario: nuevo, generado: true };
  }

  async function guardar(event: FormEvent) {
    event.preventDefault(); setError(null); setMensaje(null); setAdvertencia(null);
    const monto = Number(formulario.monto);
    if (!(monto > 0)) return setError('El monto debe ser mayor a 0.');
    if (!formulario.establecimiento.trim()) return setError('El establecimiento es obligatorio.');
    if (!formulario.fecha_gasto) return setError('La fecha es obligatoria.');
    if (!formulario.medio_pago_id) return setError('Seleccioná un medio de pago.');
    if (!formulario.categoria_id) return setError('Seleccioná una categoría.');
    if (!formulario.persona_id) return setError('Seleccioná una persona.');
    if (esTarjetaCredito && (!formulario.cuenta_tarjeta_id || !formulario.tarjeta_fisica_id || formulario.cantidad_cuotas < 1)) return setError('Para tarjeta de crédito completá cuenta, tarjeta física y cuotas válidas.');
    setGuardando(true);
    try {
      const payload = { ...formulario, monto, establecimiento: formulario.establecimiento.trim(), cuenta_tarjeta_id: esTarjetaCredito ? formulario.cuenta_tarjeta_id : null, tarjeta_fisica_id: esTarjetaCredito ? formulario.tarjeta_fisica_id : null, cantidad_cuotas: esTarjetaCredito ? formulario.cantidad_cuotas : 1 };
      const { data: gasto, error: eg } = await supabase.from('gastos').insert(payload).select('id').single();
      if (eg || !gasto) throw new Error('No se pudo guardar el gasto.');

      if (esTarjetaCredito) {
        const cuenta = cuentas.find((c) => c.id === formulario.cuenta_tarjeta_id);
        if (!cuenta) throw new Error('No se encontró la cuenta de tarjeta seleccionada.');

        let periodo = formatearPeriodoDesdeFecha(formulario.fecha_gasto);
        let usaronEstimados = false;
        const calendarioBase = await asegurarCalendario(cuenta, periodo);
        usaronEstimados ||= calendarioBase.generado || calendarioBase.calendario.estado_calendario === 'estimado';
        let resultado = calcularPeriodoTarjeta({ fecha_gasto: formulario.fecha_gasto, cuenta_tarjeta_id: cuenta.id, calendarios: [...calendarios, calendarioBase.calendario] });

        const cuotasPayload = [];
        for (let i = 0; i < formulario.cantidad_cuotas; i += 1) {
          const periodoResumenCuota = i === 0 ? resultado.periodo_resumen : sumarMesesPeriodo(resultado.periodo_resumen, i);
          const calCuota = await asegurarCalendario(cuenta, periodoResumenCuota);
          usaronEstimados ||= calCuota.generado || calCuota.calendario.estado_calendario === 'estimado';
          const periodoPago = i === 0 ? resultado.periodo_pago : sumarMesesPeriodo(resultado.periodo_pago, i);
          cuotasPayload.push({
            gasto_id: gasto.id,
            cuenta_tarjeta_id: cuenta.id,
            tarjeta_fisica_id: formulario.tarjeta_fisica_id,
            persona_id: formulario.persona_id,
            establecimiento: formulario.establecimiento.trim(),
            descripcion_cuota: formulario.descripcion.trim() || formulario.establecimiento.trim(),
            numero_cuota: i + 1,
            total_cuotas: formulario.cantidad_cuotas,
            monto_cuota: monto / formulario.cantidad_cuotas,
            moneda: formulario.moneda,
            periodo_pago_estimado: periodoPago,
            fecha_estimada_pago: calCuota.calendario.fecha_vencimiento,
            estado: 'pendiente',
            origen_cuota: 'gasto_nuevo',
          });
        }
        const { error: ec } = await supabase.from('cuotas_tarjeta').insert(cuotasPayload);
        if (ec) throw new Error('Se guardó el gasto, pero falló la generación de cuotas.');
        if (usaronEstimados) setAdvertencia('Se usaron fechas estimadas de cierre/vencimiento. Podés confirmarlas luego desde Calendario.');
      }

      setMensaje('Gasto registrado con éxito.');
      setFormulario({ ...inicial, fecha_gasto: HOY });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error al guardar el gasto.');
    } finally { setGuardando(false); }
  }

  return <section className="mx-auto max-w-4xl space-y-4"><h1 className="text-2xl font-semibold">Nuevo gasto</h1>{error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}{mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{mensaje}</p>}{advertencia && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">{advertencia}</p>}<form onSubmit={guardar} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><label className="text-sm font-medium">Monto *</label><input value={formulario.monto} onChange={(e) => setFormulario((p) => ({ ...p, monto: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-xl border px-4 py-3 text-2xl font-semibold" placeholder="0,00" /></div><div className="grid grid-cols-2 gap-2"><input value={formulario.moneda} onChange={(e) => setFormulario((p) => ({ ...p, moneda: e.target.value }))} className="rounded-xl border px-3 py-2" /><input type="date" value={formulario.fecha_gasto} onChange={(e) => setFormulario((p) => ({ ...p, fecha_gasto: e.target.value }))} className="rounded-xl border px-3 py-2" /></div><div><p className="mb-2 text-sm font-medium">Medio de pago *</p><div className="grid grid-cols-2 gap-2">{medios.map((medio) => <button key={medio.id} type="button" onClick={() => setFormulario((p) => ({ ...p, medio_pago_id: medio.id }))} className={`rounded-xl border px-3 py-2 text-sm ${formulario.medio_pago_id === medio.id ? 'border-emerald-500 bg-emerald-50' : ''}`}>{medio.nombre}</button>)}</div></div>
<div><label className="text-sm font-medium">Establecimiento *</label><input value={formulario.establecimiento} onChange={(e) => setFormulario((p) => ({ ...p, establecimiento: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></div>
<div><p className="mb-2 text-sm font-medium">Categoría *</p><div className="grid grid-cols-2 gap-2">{categorias.map((cat) => <button key={cat.id} type="button" onClick={() => setFormulario((p) => ({ ...p, categoria_id: cat.id }))} className={`rounded-xl border px-3 py-2 text-sm ${formulario.categoria_id === cat.id ? 'border-emerald-500 bg-emerald-50' : ''}`}>{cat.icono ? `${cat.icono} ` : ''}{cat.nombre}</button>)}</div></div>
{esTarjetaCredito && <><div><p className="mb-2 text-sm font-medium">Cuenta de tarjeta *</p><div className="space-y-2">{cuentas.map((cuenta) => <button key={cuenta.id} type="button" onClick={() => setFormulario((p) => ({ ...p, cuenta_tarjeta_id: cuenta.id, tarjeta_fisica_id: '' }))} className={`w-full rounded-xl border p-3 text-left ${formulario.cuenta_tarjeta_id === cuenta.id ? 'border-emerald-500 bg-emerald-50' : ''}`}><p className="font-medium">{cuenta.nombre_cuenta}</p><p className="text-xs text-slate-500">{cuenta.banco ?? ''} {cuenta.marca ?? ''}</p></button>)}</div></div>
<div><p className="mb-2 text-sm font-medium">Tarjeta física *</p><div className="space-y-2">{tarjetasCuenta.map((tarjeta) => <button key={tarjeta.id} type="button" onClick={() => setFormulario((p) => ({ ...p, tarjeta_fisica_id: tarjeta.id, persona_id: tarjeta.persona_id }))} className={`w-full rounded-xl border p-3 text-left ${formulario.tarjeta_fisica_id === tarjeta.id ? 'border-emerald-500 bg-emerald-50' : ''}`}>{tarjeta.alias ?? tarjeta.tipo} {tarjeta.ultimos_4_digitos ? `• ${tarjeta.ultimos_4_digitos}` : ''}</button>)}</div></div>
<div><label className="text-sm font-medium">Cantidad de cuotas *</label><input type="number" min={1} value={formulario.cantidad_cuotas} onChange={(e) => setFormulario((p) => ({ ...p, cantidad_cuotas: Number(e.target.value) || 1 }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></div></>}
<div><label className="text-sm font-medium">Persona *</label><select value={formulario.persona_id} onChange={(e) => setFormulario((p) => ({ ...p, persona_id: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Seleccionar persona</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} {persona.apellido ?? ''}</option>)}</select></div>
<button type="button" onClick={() => setMostrarAvanzado((v) => !v)} className="text-sm text-slate-600">{mostrarAvanzado ? 'Ocultar campos avanzados' : 'Mostrar campos avanzados'}</button>
{mostrarAvanzado && <div className="grid gap-2"><input value={formulario.descripcion} onChange={(e) => setFormulario((p) => ({ ...p, descripcion: e.target.value }))} className="rounded-xl border px-3 py-2" placeholder="Descripción" /><textarea value={formulario.observaciones} onChange={(e) => setFormulario((p) => ({ ...p, observaciones: e.target.value }))} className="rounded-xl border px-3 py-2" placeholder="Observaciones" /></div>}
<div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">Resumen</p><p>{formulario.establecimiento || 'Sin establecimiento'} · {formulario.moneda} {formulario.monto || '0'} · {esTarjetaCredito ? `${formulario.cantidad_cuotas} cuota(s)` : 'Pago único'}</p></div>
<button disabled={guardando} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">{guardando ? 'Guardando...' : 'Guardar gasto'}</button></form></section>;
}
