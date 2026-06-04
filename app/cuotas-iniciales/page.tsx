'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';
import { construirFechaCierreEstimada, construirFechaVencimientoEstimada, sumarMesesPeriodo } from '@/utils/tarjetas';

type CuentaTarjeta = { id: string; nombre_cuenta: string; banco: string | null; marca: string | null; dia_cierre_habitual: number | null; dias_hasta_vencimiento: number | null };
type TarjetaFisica = { id: string; cuenta_tarjeta_id: string; persona_id: string; alias: string | null; tipo: string; ultimos_4_digitos: string | null };
type Persona = { id: string; nombre: string; apellido: string | null };
type Categoria = { id: string; nombre: string };
type CompraInicial = {
  id: string;
  fecha_compra_original: string | null;
  establecimiento: string | null;
  descripcion_compra: string | null;
  cuenta_tarjeta_id: string;
  tarjeta_fisica_id: string | null;
  persona_id: string;
  categoria_id: string | null;
  observaciones: string | null;
  cuota_inicio_pendiente: number;
  total_cuotas: number;
  monto_cuota: number;
  moneda: string;
  periodo_inicio_pago: string;
  estado: string;
};
type CuotaGenerada = { id: string; compra_cuota_inicial_id: string; numero_cuota: number; total_cuotas: number; periodo_pago_estimado: string; monto_cuota: number; moneda: string; estado: string; origen_cuota?: string; observaciones?: string | null; tarjeta_fisica_id: string | null; persona_id: string };
type Formulario = { fecha_compra_original: string; establecimiento: string; descripcion_compra: string; cuenta_tarjeta_id: string; tarjeta_fisica_id: string; persona_id: string; cuota_inicio_pendiente: number; total_cuotas: number; monto_cuota: string; moneda: string; periodo_inicio_pago: string; categoria_id: string; observaciones: string };

const FORMATO_PERIODO = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const ESTADOS_EDITABLES = new Set(['pendiente', 'proyectada', 'no_incluida', 'reprogramada']);
const ESTADOS_NO_PROPAGAR = new Set(['pagada', 'cancelada']);
const MENSAJE_CUOTA_NO_EDITABLE = 'Esta cuota no puede modificarse porque ya está pagada o cancelada.';

const inicial: Formulario = { fecha_compra_original: '', establecimiento: '', descripcion_compra: '', cuenta_tarjeta_id: '', tarjeta_fisica_id: '', persona_id: '', cuota_inicio_pendiente: 1, total_cuotas: 1, monto_cuota: '', moneda: 'ARS', periodo_inicio_pago: '', categoria_id: '', observaciones: '' };

export default function Page() {
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<Formulario>(inicial);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [compras, setCompras] = useState<CompraInicial[]>([]);
  const [cuotasPorCompra, setCuotasPorCompra] = useState<Record<string, CuotaGenerada[]>>({});
  const [compraExpandida, setCompraExpandida] = useState<string | null>(null);
  const [compraEditandoId, setCompraEditandoId] = useState<string | null>(null);
  const [periodosVistaPrevia, setPeriodosVistaPrevia] = useState<string[]>([]);
  const [edicionCompra, setEdicionCompra] = useState<Partial<Formulario>>({});
  const [periodosEdicionCuotas, setPeriodosEdicionCuotas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarTodasCuotas, setMostrarTodasCuotas] = useState<Record<string, boolean>>({});

  const tarjetasFiltradas = useMemo(() => tarjetas.filter((tarjeta) => tarjeta.cuenta_tarjeta_id === formulario.cuenta_tarjeta_id), [tarjetas, formulario.cuenta_tarjeta_id]);
  const mapaCuenta = useMemo(() => new Map(cuentas.map((cuenta) => [cuenta.id, cuenta.nombre_cuenta])), [cuentas]);
  const mapaTarjeta = useMemo(() => new Map(tarjetas.map((tarjeta) => [tarjeta.id, `${tarjeta.alias ?? tarjeta.tipo}${tarjeta.ultimos_4_digitos ? ` • ${tarjeta.ultimos_4_digitos}` : ''}`])), [tarjetas]);
  const mapaPersona = useMemo(() => new Map(personas.map((persona) => [persona.id, `${persona.nombre} ${persona.apellido ?? ''}`.trim()])), [personas]);
  const mapaCategoria = useMemo(() => new Map(categorias.map((categoria) => [categoria.id, categoria.nombre])), [categorias]);

  const vistaPrevia = useMemo(() => {
    if (!FORMATO_PERIODO.test(formulario.periodo_inicio_pago)) return [];
    if (formulario.cuota_inicio_pendiente > formulario.total_cuotas) return [];
    const monto = Number(formulario.monto_cuota);
    if (!(monto > 0)) return [];
    const longitud = formulario.total_cuotas - formulario.cuota_inicio_pendiente + 1;
    return Array.from({ length: longitud }, (_, idx) => ({ numero: formulario.cuota_inicio_pendiente + idx, monto, periodo: periodosVistaPrevia[idx] ?? sumarMesesPeriodo(formulario.periodo_inicio_pago, idx) }));
  }, [formulario, periodosVistaPrevia]);

  useEffect(() => { (async () => { try { const perfil = await obtenerPerfilActivo(); setGrupoId(perfil.grupo_id); setUsuarioEmail(perfil.email); if (process.env.NODE_ENV !== 'production') console.debug('[SpendWise][cuotas-iniciales] grupo_id usado', perfil.grupo_id, { email: perfil.email }); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el grupo activo.'); } })(); }, []);
  useEffect(() => { if (!grupoId) return; void cargarDatos(); }, [grupoId]);
  useEffect(() => {
    const longitud = formulario.total_cuotas - formulario.cuota_inicio_pendiente + 1;
    if (longitud <= 0 || !FORMATO_PERIODO.test(formulario.periodo_inicio_pago)) return setPeriodosVistaPrevia([]);
    setPeriodosVistaPrevia(Array.from({ length: longitud }, (_, idx) => sumarMesesPeriodo(formulario.periodo_inicio_pago, idx)));
  }, [formulario.total_cuotas, formulario.cuota_inicio_pendiente, formulario.periodo_inicio_pago]);

  async function cargarDatos() {
    if (!grupoId) return;
    const [ct, tf, p, c, ci] = await Promise.all([
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta,banco,marca,dia_cierre_habitual,dias_hasta_vencimiento').eq('grupo_id', grupoId).eq('activo', true).order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,cuenta_tarjeta_id,persona_id,alias,tipo,ultimos_4_digitos').eq('grupo_id', grupoId).eq('activo', true),
      supabase.from('personas').select('id,nombre,apellido').eq('activo', true).eq('grupo_id', grupoId).order('nombre'),
      supabase.from('categorias').select('id,nombre').eq('activo', true).eq('grupo_id', grupoId).order('nombre'),
      supabase.from('compras_cuotas_iniciales').select('id,fecha_compra_original,establecimiento,descripcion_compra,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,categoria_id,observaciones,cuota_inicio_pendiente,total_cuotas,monto_cuota,moneda,periodo_inicio_pago,estado').eq('grupo_id', grupoId).order('creado_en', { ascending: false }),
    ]);
    if (ct.error || tf.error || p.error || c.error || ci.error) return setError('No se pudieron cargar los datos de cuotas iniciales.');
    setCuentas((ct.data ?? []) as CuentaTarjeta[]);
    setTarjetas((tf.data ?? []) as TarjetaFisica[]);
    setPersonas((p.data ?? []) as Persona[]);
    setCategorias((c.data ?? []) as Categoria[]);
    setCompras((ci.data ?? []) as CompraInicial[]);
    if (process.env.NODE_ENV !== 'production') console.debug('[SpendWise][cuotas-iniciales] registros cargados', { email: usuarioEmail, grupo_id: grupoId, compras: ci.data?.length ?? 0 });
  }

  async function guardar(event: FormEvent) {
    event.preventDefault();
    setError(null); setMensaje(null);
    if (!grupoId) return setError('Cargando grupo…');
    if (!formulario.establecimiento.trim()) return setError('El establecimiento es obligatorio.');
    if (!formulario.cuenta_tarjeta_id) return setError('La cuenta de tarjeta es obligatoria.');
    if (!formulario.persona_id) return setError('La persona es obligatoria.');
    if (!FORMATO_PERIODO.test(formulario.periodo_inicio_pago)) return setError('El período inicial debe tener formato AAAA-MM.');
    if (formulario.cuota_inicio_pendiente < 1 || formulario.total_cuotas < 1) return setError('Las cuotas deben ser mayores o iguales a 1.');
    if (formulario.cuota_inicio_pendiente > formulario.total_cuotas) return setError('La cuota inicial pendiente no puede superar al total de cuotas.');
    if (vistaPrevia.some((fila) => !FORMATO_PERIODO.test(fila.periodo))) return setError('Todos los períodos de la vista previa deben tener formato AAAA-MM.');
    const monto = Number(formulario.monto_cuota);
    if (!(monto > 0)) return setError('El monto por cuota debe ser mayor a 0.');

    setGuardando(true);
    try {
      const { data: compra, error: errorCompra } = await supabase.from('compras_cuotas_iniciales').insert({ grupo_id: grupoId, fecha_compra_original: formulario.fecha_compra_original || null, establecimiento: formulario.establecimiento.trim(), descripcion_compra: formulario.descripcion_compra.trim() || null, cuenta_tarjeta_id: formulario.cuenta_tarjeta_id, tarjeta_fisica_id: formulario.tarjeta_fisica_id || null, persona_id: formulario.persona_id, cuota_inicio_pendiente: formulario.cuota_inicio_pendiente, total_cuotas: formulario.total_cuotas, monto_cuota: monto, moneda: formulario.moneda, periodo_inicio_pago: formulario.periodo_inicio_pago, categoria_id: formulario.categoria_id || null, observaciones: formulario.observaciones.trim() || null, estado: 'activa' }).select('id').single();
      if (errorCompra || !compra) throw new Error('No se pudo guardar la compra de cuotas iniciales.');

      const cuotas = vistaPrevia.map((fila) => ({ compra_cuota_inicial_id: compra.id, gasto_id: null, cuenta_tarjeta_id: formulario.cuenta_tarjeta_id, tarjeta_fisica_id: formulario.tarjeta_fisica_id || null, persona_id: formulario.persona_id, establecimiento: formulario.establecimiento.trim(), descripcion_cuota: formulario.descripcion_compra.trim() || formulario.establecimiento.trim(), numero_cuota: fila.numero, total_cuotas: formulario.total_cuotas, monto_cuota: monto, moneda: formulario.moneda, periodo_pago_estimado: fila.periodo, estado: 'pendiente', origen_cuota: 'carga_inicial', observaciones: formulario.observaciones.trim() || null }));
      const { error: errorCuotas } = await supabase.from('cuotas_tarjeta').insert(cuotas.map((item) => ({ ...item, grupo_id: grupoId })));
      if (errorCuotas) throw new Error('Se guardó la compra inicial, pero falló la generación de cuotas.');

      setFormulario(inicial);
      setMensaje('Carga inicial guardada y cuotas generadas.');
      await cargarDatos();
    } catch (e) { setError(e instanceof Error ? e.message : 'Error inesperado al guardar.'); } finally { setGuardando(false); }
  }

  async function obtenerCuotasCompra(compraId: string) {
    if (!grupoId) throw new Error('Cargando grupo…');
    const { data, error: err } = await supabase.from('cuotas_tarjeta').select('id,compra_cuota_inicial_id,numero_cuota,total_cuotas,periodo_pago_estimado,monto_cuota,moneda,estado,origen_cuota,observaciones,tarjeta_fisica_id,persona_id').eq('compra_cuota_inicial_id', compraId).eq('grupo_id', grupoId).order('numero_cuota');
    if (err) throw new Error('No se pudieron consultar las cuotas generadas.');
    return (data ?? []) as CuotaGenerada[];
  }

  async function verCuotas(compraId: string) {
    if (cuotasPorCompra[compraId]) return setCompraExpandida((prev) => (prev === compraId ? null : compraId));
    try {
      const cuotas = await obtenerCuotasCompra(compraId);
      setCuotasPorCompra((prev) => ({ ...prev, [compraId]: cuotas }));
      setCompraExpandida(compraId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron consultar las cuotas generadas.');
    }
  }

  async function iniciarEdicion(compra: CompraInicial) {
    setError(null);
    setMensaje(null);
    let cuotas: CuotaGenerada[] = [];
    try {
      cuotas = cuotasPorCompra[compra.id] ?? await obtenerCuotasCompra(compra.id);
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'No se pudieron consultar las cuotas generadas.');
    }
    setCuotasPorCompra((prev) => ({ ...prev, [compra.id]: cuotas }));
    setCompraExpandida(compra.id);
    setCompraEditandoId(compra.id);
    setEdicionCompra({
      fecha_compra_original: compra.fecha_compra_original ?? '', establecimiento: compra.establecimiento ?? '', descripcion_compra: compra.descripcion_compra ?? '', categoria_id: compra.categoria_id ?? '', observaciones: compra.observaciones ?? '', tarjeta_fisica_id: compra.tarjeta_fisica_id ?? '', persona_id: compra.persona_id,
    });
    const cuotasEditables = cuotas;
    setPeriodosEdicionCuotas(Object.fromEntries(cuotasEditables.map((cuota) => [cuota.id, cuota.periodo_pago_estimado])));
  }

  async function guardarEdicion(compra: CompraInicial) {
    if (!grupoId) return setError('Cargando grupo…');
    if (!compraEditandoId) return;
    setError(null);
    setMensaje(null);
    const payload = {
      fecha_compra_original: edicionCompra.fecha_compra_original || null,
      establecimiento: edicionCompra.establecimiento?.trim() || null,
      descripcion_compra: edicionCompra.descripcion_compra?.trim() || null,
      categoria_id: edicionCompra.categoria_id || null,
      observaciones: edicionCompra.observaciones?.trim() || null,
      tarjeta_fisica_id: edicionCompra.tarjeta_fisica_id || null,
      persona_id: edicionCompra.persona_id || null,
    };
    const { error: errCompra } = await supabase.from('compras_cuotas_iniciales').update(payload).eq('id', compraEditandoId).eq('grupo_id', grupoId);
    if (errCompra) return setError('No se pudo guardar la edición de la carga inicial.');

    const cuotas = cuotasPorCompra[compraEditandoId] ?? [];
    let huboCambioNoEditable = false;
    for (const cuota of cuotas) {
      const periodoNuevo = periodosEdicionCuotas[cuota.id];
      if (periodoNuevo && periodoNuevo !== cuota.periodo_pago_estimado) {
        if (!FORMATO_PERIODO.test(periodoNuevo)) return setError('El período debe tener formato YYYY-MM.');
        if (!ESTADOS_EDITABLES.has(cuota.estado)) {
          huboCambioNoEditable = true;
        } else {
          const calendario = await resolverCalendarioParaPeriodo(compra.cuenta_tarjeta_id, periodoNuevo);
          if (!calendario) {
            return setError('No se pudo mover la cuota porque la cuenta no tiene configuración habitual de cierre/vencimiento.');
          }
          const observacionesAnteriores = cuota.observaciones?.trim() ?? '';
          const notaReprogramacion = 'Período modificado manualmente.';
          const observacionesActualizadas = observacionesAnteriores.includes(notaReprogramacion)
            ? observacionesAnteriores
            : [observacionesAnteriores, notaReprogramacion].filter(Boolean).join(' ');
          const { error } = await supabase.from('cuotas_tarjeta').update({
            periodo_pago_estimado: periodoNuevo,
            fecha_estimada_pago: calendario.fecha_vencimiento,
            estado: cuota.estado === 'pendiente' ? 'reprogramada' : cuota.estado,
            observaciones: observacionesActualizadas || null,
            actualizado_en: new Date().toISOString(),
          }).eq('id', cuota.id).eq('grupo_id', grupoId);
          if (error) return setError('No se pudo actualizar el período de una cuota pendiente.');
        }
      }
      const cambioPersonaOTarjeta = (edicionCompra.persona_id && edicionCompra.persona_id !== cuota.persona_id) || (edicionCompra.tarjeta_fisica_id !== undefined && (edicionCompra.tarjeta_fisica_id || null) !== cuota.tarjeta_fisica_id);
      if (cambioPersonaOTarjeta && !ESTADOS_NO_PROPAGAR.has(cuota.estado)) {
        const { error } = await supabase.from('cuotas_tarjeta').update({ persona_id: edicionCompra.persona_id, tarjeta_fisica_id: edicionCompra.tarjeta_fisica_id || null }).eq('id', cuota.id).eq('grupo_id', grupoId);
        if (error) return setError('No se pudo propagar persona/tarjeta en cuotas pendientes.');
      }
    }

    await cargarDatos();
    const { data: compraActualizada, error: errorCompraActualizada } = await supabase
      .from('compras_cuotas_iniciales')
      .select('id,fecha_compra_original,establecimiento,descripcion_compra,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,categoria_id,observaciones,cuota_inicio_pendiente,total_cuotas,monto_cuota,moneda,periodo_inicio_pago,estado')
      .eq('id', compra.id)
      .eq('grupo_id', grupoId)
      .single();
    if (errorCompraActualizada || !compraActualizada) return setError('Se guardó la edición, pero no se pudo refrescar la carga inicial.');
    const cuotasActualizadas = await obtenerCuotasCompra(compra.id);
    setCompras((prev) => prev.map((item) => item.id === compra.id ? (compraActualizada as CompraInicial) : item));
    setCuotasPorCompra((prev) => ({ ...prev, [compra.id]: cuotasActualizadas }));
    setCompraExpandida(compra.id);
    setPeriodosEdicionCuotas(Object.fromEntries(cuotasActualizadas.map((cuota) => [cuota.id, cuota.periodo_pago_estimado])));
    setCompraEditandoId(null);
    setMensaje('Carga inicial actualizada correctamente.');
    if (huboCambioNoEditable) setError(MENSAJE_CUOTA_NO_EDITABLE);
  }

  async function resolverCalendarioParaPeriodo(cuentaTarjetaId: string, periodoResumen: string): Promise<{ fecha_vencimiento: string } | null> {
    if (!grupoId) throw new Error('Cargando grupo…');
    const { data: calendarioExistente, error: errorConsulta } = await supabase
      .from('calendario_tarjetas')
      .select('id,fecha_vencimiento')
      .eq('cuenta_tarjeta_id', cuentaTarjetaId)
      .eq('periodo_resumen', periodoResumen)
      .eq('grupo_id', grupoId)
      .maybeSingle();
    if (errorConsulta) throw new Error('No se pudo validar el calendario de la cuenta.');
    if (calendarioExistente?.fecha_vencimiento) return { fecha_vencimiento: calendarioExistente.fecha_vencimiento };

    const cuenta = cuentas.find((item) => item.id === cuentaTarjetaId);
    if (!cuenta?.dia_cierre_habitual || cuenta.dias_hasta_vencimiento === null) return null;
    const fechaCierre = construirFechaCierreEstimada(periodoResumen, cuenta.dia_cierre_habitual);
    const fechaVencimiento = construirFechaVencimientoEstimada(fechaCierre, cuenta.dias_hasta_vencimiento);

    const { data: calendarioCreado, error: errorCreacion } = await supabase
      .from('calendario_tarjetas')
      .insert({
        grupo_id: grupoId,
        cuenta_tarjeta_id: cuentaTarjetaId,
        periodo_resumen: periodoResumen,
        fecha_cierre: fechaCierre,
        fecha_vencimiento: fechaVencimiento,
        estado_calendario: 'estimado',
        origen_fecha: 'automatico',
        observaciones: 'Generado automáticamente al reprogramar cuota de carga inicial.',
      })
      .select('id,fecha_vencimiento')
      .single();
    if (errorCreacion || !calendarioCreado?.fecha_vencimiento) return null;
    return { fecha_vencimiento: calendarioCreado.fecha_vencimiento };
  }

  async function anular(compraId: string) {
    if (!grupoId) return setError('Cargando grupo…');
    const { error: errCompra } = await supabase.from('compras_cuotas_iniciales').update({ estado: 'anulada' }).eq('id', compraId).eq('grupo_id', grupoId);
    if (errCompra) return setError('No se pudo anular la carga inicial.');
    const { error: errCuotas } = await supabase.from('cuotas_tarjeta').update({ estado: 'cancelada' }).eq('compra_cuota_inicial_id', compraId).eq('grupo_id', grupoId).neq('estado', 'pagada');
    if (errCuotas) return setError('No se pudieron cancelar las cuotas pendientes asociadas.');
    setMensaje('Carga inicial anulada correctamente.');
    await cargarDatos();
  }

  return (
    <section className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Cuotas iniciales</h1>
      <p className="text-sm text-slate-600">Cargá compras anteriores con cuotas pendientes sin registrar el gasto histórico completo.</p>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}
      {mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{mensaje}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={guardar} className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Nueva carga manual</h2>
          <label className="block text-sm font-medium">Monto de cada cuota<input value={formulario.monto_cuota} onChange={(e) => setFormulario((p) => ({ ...p, monto_cuota: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-3 text-xl font-semibold" /></label>
          <p className="-mt-2 text-xs text-slate-500">Importe que corresponde pagar por cada cuota pendiente.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block text-sm font-medium">Fecha de compra original<input type="date" value={formulario.fecha_compra_original} onChange={(e) => setFormulario((p) => ({ ...p, fecha_compra_original: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="block text-sm font-medium">Primer período pendiente<input value={formulario.periodo_inicio_pago} onChange={(e) => setFormulario((p) => ({ ...p, periodo_inicio_pago: e.target.value }))} placeholder="AAAA-MM" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          </div>
          <p className="-mt-2 text-xs text-slate-500">Fecha en que se realizó la compra original. Puede quedar vacía si no la recordás.</p>
          <p className="-mt-2 text-xs text-slate-500">Mes desde el cual querés empezar a controlar las cuotas pendientes. Formato AAAA-MM.</p>
          <label className="block text-sm font-medium">Establecimiento<input value={formulario.establecimiento} onChange={(e) => setFormulario((p) => ({ ...p, establecimiento: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="block text-sm font-medium">Descripción de compra<input value={formulario.descripcion_compra} onChange={(e) => setFormulario((p) => ({ ...p, descripcion_compra: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="block text-sm font-medium">Cuenta de tarjeta<select value={formulario.cuenta_tarjeta_id} onChange={(e) => setFormulario((p) => ({ ...p, cuenta_tarjeta_id: e.target.value, tarjeta_fisica_id: '' }))} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Seleccionar cuenta</option>{cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre_cuenta}</option>)}</select></label>
          <label className="block text-sm font-medium">Tarjeta física<select value={formulario.tarjeta_fisica_id} onChange={(e) => { const id = e.target.value; const tarjeta = tarjetasFiltradas.find((t) => t.id === id); setFormulario((p) => ({ ...p, tarjeta_fisica_id: id, persona_id: tarjeta?.persona_id ?? p.persona_id })); }} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Sin tarjeta específica</option>{tarjetasFiltradas.map((tarjeta) => <option key={tarjeta.id} value={tarjeta.id}>{tarjeta.alias ?? tarjeta.tipo}{tarjeta.ultimos_4_digitos ? ` • ${tarjeta.ultimos_4_digitos}` : ''}</option>)}</select></label>
          <label className="block text-sm font-medium">Persona<select value={formulario.persona_id} onChange={(e) => setFormulario((p) => ({ ...p, persona_id: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Seleccionar persona</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} {persona.apellido ?? ''}</option>)}</select></label>
          <label className="block text-sm font-medium">Categoría<select value={formulario.categoria_id} onChange={(e) => setFormulario((p) => ({ ...p, categoria_id: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Sin categoría</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select></label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-sm font-medium">Cuota pendiente inicial<input type="number" min={1} value={formulario.cuota_inicio_pendiente} onChange={(e) => setFormulario((p) => ({ ...p, cuota_inicio_pendiente: Number(e.target.value) || 1 }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="block text-sm font-medium">Total de cuotas<input type="number" min={1} value={formulario.total_cuotas} onChange={(e) => setFormulario((p) => ({ ...p, total_cuotas: Number(e.target.value) || 1 }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
            <label className="block text-sm font-medium">Moneda<input value={formulario.moneda} onChange={(e) => setFormulario((p) => ({ ...p, moneda: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          </div>
          <p className="-mt-2 text-xs text-slate-500">Número de la primera cuota que todavía queda pendiente de pago.</p>
          <p className="-mt-2 text-xs text-slate-500">Cantidad total de cuotas de la compra original.</p>
          <label className="block text-sm font-medium">Observaciones<textarea value={formulario.observaciones} onChange={(e) => setFormulario((p) => ({ ...p, observaciones: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <button disabled={guardando} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">{guardando ? 'Guardando...' : 'Guardar carga inicial'}</button>
        </form>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-semibold">Vista previa editable</h2>
          {vistaPrevia.length === 0 ? <p className="mt-2 text-sm text-slate-500">Completá los campos requeridos para ver las cuotas que se generarán.</p> : <ul className="mt-2 space-y-2">{vistaPrevia.map((fila, idx) => <li key={fila.numero} className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">{fila.numero}/{formulario.total_cuotas} · {new Intl.NumberFormat('es-AR', { style: 'currency', currency: formulario.moneda || 'ARS' }).format(fila.monto)}</p><label className="mt-1 block text-xs text-slate-600">Período estimado<input value={fila.periodo} onChange={(e) => setPeriodosVistaPrevia((prev) => prev.map((v, index) => index === idx ? e.target.value : v))} className="mt-1 w-full rounded-lg border px-2 py-1 text-sm" /></label></li>)}</ul>}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Cargas iniciales registradas</h2>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-2 py-1">Establecimiento</th><th className="px-2 py-1">Descripción</th><th className="px-2 py-1">Cuenta</th><th className="px-2 py-1">Tarjeta física</th><th className="px-2 py-1">Persona</th><th className="px-2 py-1">Categoría</th><th className="px-2 py-1">Cuota inicial/total</th><th className="px-2 py-1">Período inicio</th><th className="px-2 py-1">Monto cuota</th><th className="px-2 py-1">Estado</th><th className="px-2 py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>{compras.map((compra) => <tr key={compra.id} className="border-b align-top">
              <td className="px-2 py-1">{compra.establecimiento ?? '-'}</td><td className="px-2 py-1">{compra.descripcion_compra ?? '-'}</td><td className="px-2 py-1">{mapaCuenta.get(compra.cuenta_tarjeta_id) ?? '-'}</td><td className="px-2 py-1">{compra.tarjeta_fisica_id ? mapaTarjeta.get(compra.tarjeta_fisica_id) : 'Sin tarjeta'}</td><td className="px-2 py-1">{mapaPersona.get(compra.persona_id) ?? '-'}</td><td className="px-2 py-1">{compra.categoria_id ? mapaCategoria.get(compra.categoria_id) : 'Sin categoría'}</td><td className="px-2 py-1">{compra.cuota_inicio_pendiente}/{compra.total_cuotas}</td><td className="px-2 py-1">{compra.periodo_inicio_pago}</td><td className="px-2 py-1">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: compra.moneda }).format(compra.monto_cuota)}</td><td className="px-2 py-1">{compra.estado}</td>
              <td className="px-2 py-1"><div className="flex flex-wrap gap-1"><button onClick={() => void verCuotas(compra.id)} className="rounded border px-2 py-1">Ver cuotas</button><button onClick={() => void iniciarEdicion(compra)} className="rounded border border-sky-200 px-2 py-1 text-sky-700">Editar</button><button onClick={() => void anular(compra.id)} disabled={compra.estado === 'anulada'} className="rounded border border-rose-200 px-2 py-1 text-rose-700 disabled:opacity-50">Anular</button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="space-y-2 md:hidden">{compras.map((compra) => <article key={compra.id} className="rounded-xl border p-2 text-xs"><div className="space-y-0.5"><p className="font-medium">{compra.establecimiento ?? 'Sin establecimiento'}</p><p className="text-slate-600">{compra.descripcion_compra ?? 'Sin descripción'}</p><p>{compra.cuota_inicio_pendiente}/{compra.total_cuotas} · {compra.periodo_inicio_pago} · {compra.estado}</p></div><div className="mt-2 flex flex-wrap gap-1"><button onClick={() => void verCuotas(compra.id)} className="rounded border px-2 py-1">Ver cuotas</button><button onClick={() => void iniciarEdicion(compra)} className="rounded border border-sky-200 px-2 py-1 text-sky-700">Editar</button><button onClick={() => void anular(compra.id)} disabled={compra.estado === 'anulada'} className="rounded border border-rose-200 px-2 py-1 text-rose-700 disabled:opacity-50">Anular</button></div></article>)}</div>
        <div className="space-y-3">{compras.filter((compra) => compraEditandoId === compra.id || compraExpandida === compra.id).map((compra) => <article key={compra.id} className="rounded-xl border p-3">
            {compraEditandoId === compra.id && <div className="mt-3 space-y-2 rounded-lg border border-sky-100 bg-sky-50 p-3"><p className="text-xs text-slate-700">Para corregir monto, cuota inicial o total de cuotas, anulá esta carga y creá una nueva.</p><div className="grid gap-2 sm:grid-cols-2"><input type="date" value={edicionCompra.fecha_compra_original ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, fecha_compra_original: e.target.value }))} className="rounded-lg border px-2 py-1" /><input value={edicionCompra.establecimiento ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, establecimiento: e.target.value }))} placeholder="Establecimiento" className="rounded-lg border px-2 py-1" /><input value={edicionCompra.descripcion_compra ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, descripcion_compra: e.target.value }))} placeholder="Descripción" className="rounded-lg border px-2 py-1" /><select value={edicionCompra.categoria_id ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, categoria_id: e.target.value }))} className="rounded-lg border px-2 py-1"><option value="">Sin categoría</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select><select value={edicionCompra.tarjeta_fisica_id ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, tarjeta_fisica_id: e.target.value }))} className="rounded-lg border px-2 py-1"><option value="">Sin tarjeta específica</option>{tarjetas.filter((tarjeta) => tarjeta.cuenta_tarjeta_id === compra.cuenta_tarjeta_id).map((tarjeta) => <option key={tarjeta.id} value={tarjeta.id}>{mapaTarjeta.get(tarjeta.id)}</option>)}</select><select value={edicionCompra.persona_id ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, persona_id: e.target.value }))} className="rounded-lg border px-2 py-1"><option value="">Seleccionar persona</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{mapaPersona.get(persona.id)}</option>)}</select></div><textarea value={edicionCompra.observaciones ?? ''} onChange={(e) => setEdicionCompra((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Observaciones" className="w-full rounded-lg border px-2 py-1" />
              <button onClick={() => void guardarEdicion(compra)} className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-semibold text-white">Guardar edición</button></div>}
            {compraExpandida === compra.id && cuotasPorCompra[compra.id] && <div className="mt-2 space-y-2">
              {cuotasPorCompra[compra.id].length > 10 ? <button type="button" onClick={() => setMostrarTodasCuotas((prev) => ({ ...prev, [compra.id]: !prev[compra.id] }))} className="rounded border px-2 py-1 text-xs">{mostrarTodasCuotas[compra.id] ? 'Ver menos cuotas' : `Ver todas las cuotas (${cuotasPorCompra[compra.id].length})`}</button> : null}
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left">
                      <th className="px-2 py-1 font-medium">Cuota</th>
                      <th className="px-2 py-1 font-medium">Período</th>
                      <th className="px-2 py-1 font-medium">Monto</th>
                      <th className="px-2 py-1 font-medium">Estado</th>
                      <th className="px-2 py-1 font-medium">Origen</th>
                      <th className="px-2 py-1 font-medium">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cuotasPorCompra[compra.id].slice(0, mostrarTodasCuotas[compra.id] || cuotasPorCompra[compra.id].length <= 10 ? undefined : 10).map((cuota) => <tr key={cuota.id} className="border-b align-top">
                      <td className="px-2 py-1">{cuota.numero_cuota}/{cuota.total_cuotas}</td>
                      <td className="px-2 py-1">{compraEditandoId === compra.id && ESTADOS_EDITABLES.has(cuota.estado) ? <div className="space-y-1"><input value={periodosEdicionCuotas[cuota.id] ?? cuota.periodo_pago_estimado} onChange={(e) => setPeriodosEdicionCuotas((prev) => ({ ...prev, [cuota.id]: e.target.value }))} className="w-24 rounded border px-1 py-0.5" />{(periodosEdicionCuotas[cuota.id] ?? cuota.periodo_pago_estimado) !== cuota.periodo_pago_estimado ? <p className="text-[10px] text-amber-700">Modificado manualmente</p> : null}</div> : <span className="inline-flex rounded bg-slate-100 px-2 py-0.5">{cuota.periodo_pago_estimado}</span>}</td>
                      <td className="px-2 py-1">{new Intl.NumberFormat('es-AR', { style: 'currency', currency: cuota.moneda }).format(cuota.monto_cuota)}</td>
                      <td className="px-2 py-1">{cuota.estado}</td>
                      <td className="px-2 py-1">{cuota.origen_cuota ?? '-'}</td>
                      <td className="px-2 py-1 text-slate-600">{cuota.observaciones ?? '-'}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
              {compraEditandoId !== compra.id ? <p className="text-[11px] text-slate-500">Para editar períodos, primero presioná “Editar carga”.</p> : <p className="text-[11px] text-slate-500">Podés modificar el período si una cuota no fue cobrada en el resumen esperado.</p>}
            </div>}
          </article>)}{compras.length === 0 && <p className="text-sm text-slate-500">Todavía no hay cargas iniciales.</p>}</div>
      </div>
    </section>
  );
}
