'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuthSpendWise } from '@/components/auth-context';
import { ErrorTecnicoDesarrollo } from '@/components/error-tecnico-desarrollo';
import { SelectorGrupoActivo } from '@/components/selector-grupo-activo';
import { limpiarPerfilActivoCache } from '@/lib/auth/grupo-activo';
import { normalizarErrorTecnico, type ErrorTecnico } from '@/lib/errores';
import { supabase } from '@/lib/supabase/client';

type RolGrupo = 'admin' | 'miembro';
type Miembro = { id: string; usuario_id: string; email: string | null; rol: RolGrupo; estado: 'activo' | 'inactivo' };
type Invitacion = { id: string; email_invitado: string; rol: RolGrupo; estado: string; token: string; creado_en: string; expira_en: string | null };
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;
type AccionGrupo = 'cargar datos' | 'invitar' | 'cambiar rol' | 'quitar miembro' | 'cancelar invitación' | 'copiar invitación';

const SIN_PERMISOS = 'No tenés permisos para administrar este grupo.';
const GRUPO_SIN_ADMIN = 'El grupo debe tener al menos un administrador.';

function crearTokenInvitacion() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function crearFechaExpiracion() {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + 7);
  return fecha.toISOString();
}

function crearLink(token: string) {
  if (typeof window === 'undefined') return `/aceptar-invitacion?token=${token}`;
  return `${window.location.origin}/aceptar-invitacion?token=${token}`;
}

function etiquetaRol(rol: string) {
  return rol === 'admin' ? 'Admin' : 'Miembro';
}

function etiquetaEstado(estado: string) {
  const etiquetas: Record<string, string> = { activo: 'Activo', inactivo: 'Inactivo', pendiente: 'Pendiente', cancelada: 'Cancelada', aceptada: 'Aceptada', expirada: 'Expirada' };
  return etiquetas[estado] ?? estado;
}

function invitacionExpirada(invitacion: Invitacion) {
  return Boolean(invitacion.expira_en && new Date(invitacion.expira_en) <= new Date());
}

function fechaLegible(fecha: string | null) {
  return fecha ? new Date(fecha).toLocaleDateString('es-AR') : 'Sin vencimiento';
}

export default function GrupoPage() {
  const { perfil, session, reintentarPerfil } = useAuthSpendWise();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolGrupo>('miembro');
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [cargando, setCargando] = useState(true);
  const [accionEnCurso, setAccionEnCurso] = useState<string | null>(null);
  const [errorTecnico, setErrorTecnico] = useState<ErrorTecnico | null>(null);
  const manejarErrorSelector = useCallback((texto: string) => setMensaje({ tipo: 'error', texto }), []);
  const esAdmin = perfil?.rol === 'admin';

  const informarError = useCallback((accion: AccionGrupo, error: unknown, texto: string) => {
    const detalle = normalizarErrorTecnico(error);
    console.error('[SpendWise][grupo] Error administrando miembros', {
      accion,
      message: detalle.message,
      code: detalle.code,
      details: detalle.details,
      hint: detalle.hint,
      raw: error,
    });
    setErrorTecnico(detalle);
    setMensaje({ tipo: 'error', texto: detalle.message?.includes(GRUPO_SIN_ADMIN) ? GRUPO_SIN_ADMIN : texto });
  }, []);

  const validarAdmin = useCallback(() => {
    if (esAdmin && perfil?.grupo_id) return true;
    setMensaje({ tipo: 'error', texto: SIN_PERMISOS });
    return false;
  }, [esAdmin, perfil?.grupo_id]);

  const cargarDatos = useCallback(async () => {
    if (!perfil?.grupo_id) return;
    setCargando(true);
    const [respuestaMiembros, respuestaInvitaciones] = await Promise.all([
      supabase.from('miembros_grupo').select('id,usuario_id,email,rol,estado').eq('grupo_id', perfil.grupo_id).order('creado_en'),
      supabase.from('invitaciones_grupo').select('id,email_invitado,rol,estado,token,creado_en,expira_en').eq('grupo_id', perfil.grupo_id).eq('estado', 'pendiente').order('creado_en', { ascending: false }),
    ]);

    const error = respuestaMiembros.error ?? respuestaInvitaciones.error;
    if (error) informarError('cargar datos', error, 'No se pudo cargar la información del grupo.');
    else {
      setMiembros((respuestaMiembros.data ?? []) as Miembro[]);
      setInvitaciones((respuestaInvitaciones.data ?? []) as Invitacion[]);
    }
    setCargando(false);
  }, [informarError, perfil?.grupo_id]);

  useEffect(() => { void cargarDatos(); }, [cargarDatos]);

  async function invitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!validarAdmin() || !perfil?.grupo_id || !session?.user.id) return;
    const emailLimpio = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(emailLimpio)) {
      setMensaje({ tipo: 'error', texto: 'Ingresá un email válido.' });
      return;
    }

    const payload = { grupo_id: perfil.grupo_id, email_invitado: emailLimpio, rol, estado: 'pendiente', token: crearTokenInvitacion(), invitado_por: session.user.id, expira_en: crearFechaExpiracion() };
    setAccionEnCurso('invitar');
    setMensaje(null);
    setErrorTecnico(null);
    const { data, error } = await supabase.from('invitaciones_grupo').insert(payload).select('id,email_invitado,rol,estado,token,creado_en,expira_en').single();

    if (error || !data) informarError('invitar', error ?? new Error('Supabase no devolvió la invitación creada.'), error?.code === '23505' ? 'Ya existe una invitación pendiente para este email.' : 'No se pudo crear la invitación.');
    else {
      setEmail('');
      setInvitaciones((actuales) => [data as Invitacion, ...actuales]);
      setMensaje({ tipo: 'ok', texto: 'Invitación creada para SpendFlow Planner.' });
    }
    setAccionEnCurso(null);
  }

  async function copiar(invitacion: Invitacion) {
    try {
      await navigator.clipboard.writeText(crearLink(invitacion.token));
      setMensaje({ tipo: 'ok', texto: 'Link copiado.' });
    } catch (error) {
      informarError('copiar invitación', error, 'No se pudo copiar el link.');
    }
  }

  async function cancelar(invitacion: Invitacion) {
    if (!validarAdmin() || !window.confirm('¿Seguro que querés cancelar esta invitación?')) return;
    setAccionEnCurso(invitacion.id);
    const { error } = await supabase.from('invitaciones_grupo').update({ estado: 'cancelada' }).eq('id', invitacion.id).eq('estado', 'pendiente');
    if (error) informarError('cancelar invitación', error, 'No se pudo cancelar la invitación.');
    else {
      setInvitaciones((actuales) => actuales.filter((actual) => actual.id !== invitacion.id));
      setMensaje({ tipo: 'ok', texto: 'Invitación cancelada.' });
    }
    setAccionEnCurso(null);
  }

  async function cambiarRol(miembro: Miembro, nuevoRol: RolGrupo) {
    if (!validarAdmin() || miembro.rol === nuevoRol) return;
    setAccionEnCurso(miembro.id);
    setErrorTecnico(null);
    const { error } = await supabase.rpc('cambiar_rol_miembro_grupo', { miembro_id: miembro.id, nuevo_rol: nuevoRol });
    if (error) informarError('cambiar rol', error, 'No se pudo cambiar el rol.');
    else {
      setMiembros((actuales) => actuales.map((actual) => actual.id === miembro.id ? { ...actual, rol: nuevoRol } : actual));
      setMensaje({ tipo: 'ok', texto: `Rol actualizado a ${etiquetaRol(nuevoRol)}.` });
      if (miembro.usuario_id === session?.user.id) {
        limpiarPerfilActivoCache();
        await reintentarPerfil();
      }
    }
    setAccionEnCurso(null);
  }

  async function quitarMiembro(miembro: Miembro) {
    if (!validarAdmin() || !window.confirm('¿Seguro que querés quitar a esta persona del grupo?')) return;
    setAccionEnCurso(miembro.id);
    setErrorTecnico(null);
    const { error } = await supabase.rpc('quitar_miembro_grupo', { miembro_id: miembro.id });
    if (error) informarError('quitar miembro', error, 'No se pudo quitar a la persona del grupo.');
    else if (miembro.usuario_id === session?.user.id) {
      limpiarPerfilActivoCache();
      await reintentarPerfil();
      window.location.reload();
      return;
    } else {
      setMiembros((actuales) => actuales.map((actual) => actual.id === miembro.id ? { ...actual, estado: 'inactivo' } : actual));
      setMensaje({ tipo: 'ok', texto: 'La persona fue quitada del grupo.' });
    }
    setAccionEnCurso(null);
  }

  return <section className="mx-auto max-w-5xl space-y-6">
    <header><p className="sf-kicker mb-1">Espacio compartido</p><h1 className="text-2xl font-bold">Grupo</h1><p className="mt-1 text-sm text-slate-600">Administrá quién comparte los gastos y tarjetas del grupo activo.</p></header>
    {mensaje && <div className={`rounded-xl border px-4 py-3 text-sm ${mensaje.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{mensaje.texto}</div>}
    <ErrorTecnicoDesarrollo error={errorTecnico} />

    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-lg">◎</span><div><p className="sf-kicker">Contexto actual</p><h2 className="text-lg font-semibold">Grupo activo</h2></div></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</p><p className="mt-1 font-medium">{perfil?.grupo_nombre ?? 'Grupo activo'}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mi rol</p><p className="mt-1 font-medium">{etiquetaRol(perfil?.rol ?? 'miembro')}</p></div></div>
      <div className="mt-4 max-w-sm"><SelectorGrupoActivo mostrarTitulo onError={manejarErrorSelector} /></div>
    </article>

    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Miembros</h2><span className="text-xs text-slate-500">{miembros.filter((miembro) => miembro.estado === 'activo').length} activos</span></div>
      {cargando ? <p className="mt-4 text-sm text-slate-500">Cargando miembros...</p> : miembros.length === 0 ? <div className="sf-empty mt-4">No hay miembros para mostrar.</div> : <ul className="mt-4 divide-y divide-slate-100">{miembros.map((miembro) => <li key={miembro.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{miembro.email ?? 'Usuario sin email'}{miembro.usuario_id === session?.user.id ? ' (vos)' : ''}</p><div className="mt-1 flex gap-2 text-xs"><span className={`sf-badge ${miembro.rol === 'admin' ? 'sf-badge-info' : 'sf-badge-neutral'}`}>{etiquetaRol(miembro.rol)}</span><span className={`sf-badge ${miembro.estado === 'activo' ? 'sf-badge-success' : 'sf-badge-neutral'}`}>{etiquetaEstado(miembro.estado)}</span></div></div>{esAdmin && miembro.estado === 'activo' ? <div className="flex flex-wrap gap-2"><button type="button" disabled={accionEnCurso === miembro.id} onClick={() => void cambiarRol(miembro, miembro.rol === 'admin' ? 'miembro' : 'admin')} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60">Hacer {miembro.rol === 'admin' ? 'miembro' : 'admin'}</button><button type="button" disabled={accionEnCurso === miembro.id} onClick={() => void quitarMiembro(miembro)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60">Quitar del grupo</button></div> : null}</li>)}</ul>}
    </article>

    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold">Invitaciones pendientes</h2>
      {cargando ? <p className="mt-4 text-sm text-slate-500">Cargando invitaciones...</p> : invitaciones.length === 0 ? <div className="sf-empty mt-4">No hay invitaciones pendientes.</div> : <ul className="mt-4 divide-y divide-slate-100">{invitaciones.map((invitacion) => { const expirada = invitacionExpirada(invitacion); return <li key={invitacion.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-medium">{invitacion.email_invitado}</p><div className="mt-1 flex flex-wrap gap-2 text-xs"><span className={`sf-badge ${invitacion.rol === 'admin' ? 'sf-badge-info' : 'sf-badge-neutral'}`}>{etiquetaRol(invitacion.rol)}</span><span className={`sf-badge ${expirada ? 'sf-badge-warning' : 'sf-badge-success'}`}>{expirada ? 'Expirada' : etiquetaEstado(invitacion.estado)}</span></div><p className="mt-2 text-xs text-slate-500">Creada: {fechaLegible(invitacion.creado_en)} · Expira: {fechaLegible(invitacion.expira_en)}</p></div>{esAdmin ? <div className="flex flex-wrap gap-2"><button type="button" disabled={expirada} onClick={() => void copiar(invitacion)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Copiar link</button><button type="button" disabled={accionEnCurso === invitacion.id} onClick={() => void cancelar(invitacion)} className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60">Cancelar</button></div> : null}</li>; })}</ul>}
    </article>

    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-semibold">Invitar persona</h2>{!esAdmin ? <p className="mt-3 text-sm text-slate-600">Solo los administradores pueden invitar personas.</p> : <form onSubmit={invitar} className="mt-4 grid gap-3 sm:grid-cols-[1fr,160px,auto]"><input type="email" required value={email} onChange={(evento) => setEmail(evento.target.value)} placeholder="persona@ejemplo.com" className="rounded-xl border border-slate-300 px-3 py-2.5" /><select value={rol} onChange={(evento) => setRol(evento.target.value as RolGrupo)} className="rounded-xl border border-slate-300 px-3 py-2.5"><option value="miembro">Miembro</option><option value="admin">Admin</option></select><button disabled={accionEnCurso === 'invitar'} className="rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{accionEnCurso === 'invitar' ? 'Invitando...' : 'Invitar'}</button></form>}</article>
  </section>;
}
