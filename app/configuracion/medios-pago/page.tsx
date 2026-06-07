'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';
import { ErrorTecnicoDesarrollo } from '@/components/error-tecnico-desarrollo';
import { registrarErrorSpendWise, type ErrorTecnico } from '@/lib/errores';

type TipoMedioPago = 'efectivo' | 'debito' | 'transferencia' | 'tarjeta_credito' | 'billetera_virtual' | 'otro';

const TIPOS_MEDIO_PAGO: TipoMedioPago[] = [
  'efectivo',
  'debito',
  'transferencia',
  'tarjeta_credito',
  'billetera_virtual',
  'otro',
];

type MedioPago = {
  id: string;
  nombre: string;
  tipo: TipoMedioPago;
  activo: boolean;
  orden: number | null;
  creado_en: string;
  actualizado_en: string;
};

type FormularioMedioPago = {
  nombre: string;
  tipo: TipoMedioPago;
  orden: string;
};

const estadoInicialFormulario: FormularioMedioPago = {
  nombre: '',
  tipo: 'efectivo',
  orden: '',
};

function formatearFecha(fechaIso: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(fechaIso));
}

export default function Page() {
  const [perfilCargando, setPerfilCargando] = useState(true);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [medioPagoEditandoId, setMedioPagoEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioMedioPago>(estadoInicialFormulario);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [errorTecnico, setErrorTecnico] = useState<ErrorTecnico | null>(null);

  const tituloFormulario = useMemo(() => (medioPagoEditandoId ? 'Editar medio de pago' : 'Nuevo medio de pago'), [medioPagoEditandoId]);

  async function cargarMediosPago(grupoIdActivo: string) {
    setCargando(true);
    setMensaje(null);
    setErrorTecnico(null);

    try {

    const { data, error } = await supabase
      .from('medios_pago')
      .select('id, nombre, tipo, activo, orden, creado_en, actualizado_en')
      .eq('grupo_id', grupoIdActivo)
      .order('orden', { ascending: true, nullsFirst: false })
      .order('creado_en', { ascending: false });

    if (error) {
      const detalle = registrarErrorSpendWise('medios-pago', error);
      setErrorTecnico(detalle);
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los medios de pago.' });
      return;
    }

    const mediosFiltrados = (data ?? []).filter((medio): medio is MedioPago => TIPOS_MEDIO_PAGO.includes(medio.tipo as TipoMedioPago));
    setMediosPago(mediosFiltrados);
    if (process.env.NODE_ENV !== "production") console.debug("[debug] /medios-pago", { pantalla: "/medios-pago", email: usuarioEmail, grupo_id: grupoId, registros: mediosFiltrados.length });
    } catch (errorCarga) {
      const detalle = registrarErrorSpendWise('medios-pago', errorCarga);
      setErrorTecnico(detalle);
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar los medios de pago.' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;

    async function cargarPerfil() {
      setPerfilCargando(true);
      setErrorTecnico(null);

      try {
        const perfil = await obtenerPerfilActivo();
        if (cancelado) return;
        setGrupoId(perfil.grupo_id);
        setUsuarioEmail(perfil.email);
      } catch (errorPerfil) {
        if (cancelado) return;
        const detalle = registrarErrorSpendWise('medios-pago', errorPerfil);
        setGrupoId(null);
        setErrorTecnico(detalle);
        setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });
      } finally {
        if (!cancelado) setPerfilCargando(false);
      }
    }

    void cargarPerfil();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (perfilCargando) return;

    if (!grupoId) {
      setCargando(false);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });
      return;
    }

    void cargarMediosPago(grupoId);
  }, [perfilCargando, grupoId]);

  function limpiarFormulario() { setMedioPagoEditandoId(null); setFormulario(estadoInicialFormulario); setErrorFormulario(''); }

  function cargarFormularioParaEditar(medioPago: MedioPago) {
    setMedioPagoEditandoId(medioPago.id);
    setFormulario({ nombre: medioPago.nombre, tipo: medioPago.tipo, orden: medioPago.orden?.toString() ?? '' });
    setErrorFormulario('');
    setMensaje(null);
  }

  async function guardarMedioPago(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario('');
    setMensaje(null);

    if (!grupoId) return setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });

    const nombreLimpio = formulario.nombre.trim();
    if (!nombreLimpio) return setErrorFormulario('El nombre es obligatorio.');
    if (!TIPOS_MEDIO_PAGO.includes(formulario.tipo)) return setErrorFormulario('El tipo de medio de pago no es válido.');

    const ordenLimpio = formulario.orden.trim();
    const ordenNumero = ordenLimpio ? Number.parseInt(ordenLimpio, 10) : null;
    if (ordenLimpio && Number.isNaN(ordenNumero)) return setErrorFormulario('El orden debe ser un número válido.');

    setGuardando(true);

    const payload = { nombre: nombreLimpio, tipo: formulario.tipo, orden: ordenNumero, actualizado_en: new Date().toISOString() };
    const respuesta = medioPagoEditandoId
      ? await supabase.from('medios_pago').update(payload).eq('id', medioPagoEditandoId).eq('grupo_id', grupoId)
      : await supabase.from('medios_pago').insert({ ...payload, grupo_id: grupoId });

    if (respuesta.error) {
      const detalle = registrarErrorSpendWise('medios-pago', respuesta.error);
      setErrorTecnico(detalle);
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el medio de pago.' });
      setGuardando(false);
      return;
    }

    setMensaje({ tipo: 'ok', texto: medioPagoEditandoId ? 'Medio de pago actualizado con éxito.' : 'Medio de pago creado con éxito.' });
    setGuardando(false);
    limpiarFormulario();
    if (grupoId) await cargarMediosPago(grupoId);
  }

  async function cambiarEstadoMedioPago(medioPago: MedioPago, proximoEstado: boolean) {
    setMensaje(null);

    if (!grupoId) return setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });
    const { error } = await supabase.from('medios_pago').update({ activo: proximoEstado, actualizado_en: new Date().toISOString() }).eq('id', medioPago.id).eq('grupo_id', grupoId);
    if (error) {
      setMensaje({ tipo: 'error', texto: proximoEstado ? 'No se pudo reactivar el medio de pago.' : 'No se pudo desactivar el medio de pago.' });
      return;
    }
    setMensaje({ tipo: 'ok', texto: proximoEstado ? `Medio de pago ${medioPago.nombre} reactivado.` : `Medio de pago ${medioPago.nombre} desactivado.` });
    if (grupoId) await cargarMediosPago(grupoId);
  }

  return <section className="mx-auto max-w-6xl space-y-6"><header className="space-y-2"><h1 className="text-2xl font-semibold">Configuración · Medios de pago</h1><p className="text-sm text-slate-600">Administrá los medios de pago disponibles en SpendFlow Planner.</p></header>{perfilCargando ? <p className="text-sm text-slate-500">Cargando grupo...</p> : null}<ErrorTecnicoDesarrollo error={errorTecnico} />{mensaje && <div className={`rounded-xl border px-4 py-3 text-sm ${mensaje.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{mensaje.texto}</div>}<div className="grid gap-6 lg:grid-cols-[360px,1fr]"><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">{tituloFormulario}</h2>{medioPagoEditandoId && <button type="button" onClick={limpiarFormulario} className="text-sm font-medium text-slate-500 hover:text-slate-700">Cancelar</button>}</div><form onSubmit={guardarMedioPago} className="space-y-3"><div><label htmlFor="nombre" className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label><input id="nombre" value={formulario.nombre} onChange={(e) => setFormulario((p) => ({ ...p, nombre: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring" placeholder="Ej: Tarjeta Visa" /></div><div><label htmlFor="tipo" className="mb-1 block text-sm font-medium text-slate-700">Tipo *</label><select id="tipo" value={formulario.tipo} onChange={(e) => setFormulario((p) => ({ ...p, tipo: e.target.value as TipoMedioPago }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring">{TIPOS_MEDIO_PAGO.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select></div><div><label htmlFor="orden" className="mb-1 block text-sm font-medium text-slate-700">Orden</label><input id="orden" inputMode="numeric" value={formulario.orden} onChange={(e) => setFormulario((p) => ({ ...p, orden: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring" placeholder="Ej: 1" /></div>{errorFormulario && <p className="text-sm text-rose-600">{errorFormulario}</p>}<button type="submit" disabled={guardando} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">{guardando ? 'Guardando...' : medioPagoEditandoId ? 'Guardar cambios' : 'Agregar medio de pago'}</button></form></div><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><h2 className="mb-4 text-lg font-semibold text-slate-900">Medios de pago registrados</h2>{cargando ? <p className="text-sm text-slate-600">Cargando medios de pago...</p> : mediosPago.length === 0 ? <p className="text-sm text-slate-600">Todavía no hay medios de pago registrados.</p> : <div className="space-y-3">{mediosPago.map((medioPago) => <article key={medioPago.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{medioPago.nombre}</h3><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${medioPago.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{medioPago.activo ? 'Activo' : 'Inactivo'}</span></div><p className="text-sm text-slate-600">Tipo: {medioPago.tipo}</p><p className="text-sm text-slate-600">Orden: {medioPago.orden ?? '-'}</p><p className="text-sm text-slate-500">Creado: {formatearFecha(medioPago.creado_en)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => cargarFormularioParaEditar(medioPago)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">Editar</button><button type="button" onClick={() => cambiarEstadoMedioPago(medioPago, !medioPago.activo)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${medioPago.activo ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{medioPago.activo ? 'Desactivar' : 'Reactivar'}</button></div></article>)}</div>}</div></div></section>;
}
