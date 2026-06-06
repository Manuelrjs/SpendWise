'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuthSpendWise } from '@/components/auth-context';
import { ErrorTecnicoDesarrollo } from '@/components/error-tecnico-desarrollo';
import { normalizarErrorTecnico, type ErrorTecnico } from '@/lib/errores';
import { supabase } from '@/lib/supabase/client';

type Miembro = { id: string; nombre: string | null; email: string | null; rol: string };
type Invitacion = { id: string; email_invitado: string; rol: string; token: string; creado_en: string; expira_en: string | null };
type Mensaje = { tipo: 'ok' | 'error'; texto: string } | null;

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

export default function GrupoPage() {
  const { perfil, session } = useAuthSpendWise();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<'miembro' | 'admin'>('miembro');
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorTecnico, setErrorTecnico] = useState<ErrorTecnico | null>(null);

  const cargarDatos = useCallback(async () => {
    if (!perfil?.grupo_id) return;
    setCargando(true);
    const [respuestaMiembros, respuestaInvitaciones] = await Promise.all([
      supabase.from('perfiles').select('id,nombre,email,rol').eq('grupo_id', perfil.grupo_id).order('creado_en'),
      supabase.from('invitaciones_grupo').select('id,email_invitado,rol,token,creado_en,expira_en').eq('grupo_id', perfil.grupo_id).eq('estado', 'pendiente').order('creado_en', { ascending: false }),
    ]);

    if (respuestaMiembros.error || respuestaInvitaciones.error) {
      console.error('Error cargando configuración del grupo', respuestaMiembros.error ?? respuestaInvitaciones.error);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información del grupo.' });
    } else {
      setMiembros(respuestaMiembros.data ?? []);
      setInvitaciones(respuestaInvitaciones.data ?? []);
    }
    setCargando(false);
  }, [perfil?.grupo_id]);

  useEffect(() => { void cargarDatos(); }, [cargarDatos]);

  async function invitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!perfil?.grupo_id || perfil.rol !== 'admin' || !session?.user.id) return;
    const emailLimpio = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(emailLimpio)) {
      setMensaje({ tipo: 'error', texto: 'Ingresá un email válido.' });
      return;
    }

    const payload = {
      grupo_id: perfil.grupo_id,
      email_invitado: emailLimpio,
      rol,
      estado: 'pendiente',
      token: crearTokenInvitacion(),
      invitado_por: session.user.id,
      expira_en: crearFechaExpiracion(),
    };

    setGuardando(true);
    setMensaje(null);
    setErrorTecnico(null);
    const { data, error } = await supabase
      .from('invitaciones_grupo')
      .insert(payload)
      .select('id,email_invitado,rol,token,creado_en,expira_en')
      .single();

    if (error || !data) {
      const detalle = normalizarErrorTecnico(error ?? new Error('Supabase no devolvió la invitación creada.'));
      console.error('Error creando invitación', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        payload,
        raw: error,
      });
      setErrorTecnico({ ...detalle, raw: { error, payload } });
      setMensaje({ tipo: 'error', texto: error?.code === '23505' ? 'Ya existe una invitación pendiente para este email.' : 'No se pudo crear la invitación.' });
    } else {
      setEmail('');
      setInvitaciones((actuales) => [data, ...actuales]);
      setMensaje({ tipo: 'ok', texto: 'Invitación creada.' });
    }
    setGuardando(false);
  }

  async function copiar(token: string) {
    await navigator.clipboard.writeText(crearLink(token));
    setMensaje({ tipo: 'ok', texto: 'Link copiado.' });
  }

  async function cancelar(id: string) {
    const { error } = await supabase.from('invitaciones_grupo').update({ estado: 'cancelada' }).eq('id', id).eq('estado', 'pendiente');
    if (error) {
      console.error('Error cancelando invitación', error);
      setMensaje({ tipo: 'error', texto: 'No se pudo cancelar la invitación.' });
      return;
    }
    setInvitaciones((actuales) => actuales.filter((invitacion) => invitacion.id !== id));
    setMensaje({ tipo: 'ok', texto: 'Invitación cancelada.' });
  }

  return <section className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="text-2xl font-semibold">Grupo</h1><p className="mt-1 text-sm text-slate-600">Administrá quién comparte los gastos y tarjetas del grupo activo.</p></header>
    {mensaje && <div className={`rounded-xl border px-4 py-3 text-sm ${mensaje.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{mensaje.texto}</div>}
    <ErrorTecnicoDesarrollo error={errorTecnico} />

    <div className="grid gap-6 lg:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Datos del grupo</h2><dl className="mt-4 grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm"><dt className="text-slate-500">Nombre</dt><dd className="font-medium">{perfil?.grupo_nombre ?? 'Grupo activo'}</dd><dt className="text-slate-500">Tu email</dt><dd className="break-all font-medium">{session?.user.email ?? perfil?.email}</dd><dt className="text-slate-500">Tu rol</dt><dd className="font-medium capitalize">{perfil?.rol}</dd></dl></article>
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Miembros</h2>{cargando ? <p className="mt-4 text-sm text-slate-500">Cargando...</p> : <ul className="mt-4 divide-y divide-slate-100">{miembros.map((miembro) => <li key={miembro.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{miembro.nombre || miembro.email || 'Usuario'}</p><p className="text-xs text-slate-500">{miembro.email}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-600">{miembro.rol}</span></li>)}</ul>}</article>
    </div>

    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Invitaciones pendientes</h2>{invitaciones.length === 0 ? <p className="mt-3 text-sm text-slate-500">No hay invitaciones pendientes.</p> : <ul className="mt-4 space-y-3">{invitaciones.map((invitacion) => <li key={invitacion.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{invitacion.email_invitado}</p><p className="mt-1 text-xs text-slate-500">Rol: {invitacion.rol} · Expira: {invitacion.expira_en ? new Date(invitacion.expira_en).toLocaleDateString('es-AR') : 'sin vencimiento'}</p></div>{perfil?.rol === 'admin' && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void copiar(invitacion.token)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white">Copiar link</button><button type="button" onClick={() => void cancelar(invitacion.id)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700">Cancelar invitación</button></div>}</div></li>)}</ul>}</article>

    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Invitar persona</h2>{perfil?.rol !== 'admin' ? <p className="mt-3 text-sm text-slate-600">Solo los administradores pueden invitar personas.</p> : <form onSubmit={invitar} className="mt-4 grid gap-3 sm:grid-cols-[1fr,160px,auto]"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@ejemplo.com" className="rounded-lg border border-slate-300 px-3 py-2" /><select value={rol} onChange={(e) => setRol(e.target.value as 'miembro' | 'admin')} className="rounded-lg border border-slate-300 px-3 py-2"><option value="miembro">Miembro</option><option value="admin">Admin</option></select><button disabled={guardando} className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">{guardando ? 'Invitando...' : 'Invitar'}</button></form>}</article>
  </section>;
}
