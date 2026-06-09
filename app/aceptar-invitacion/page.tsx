'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuthSpendWise } from '@/components/auth-context';
import { limpiarPerfilActivoCache } from '@/lib/auth/grupo-activo';
import { supabase } from '@/lib/supabase/client';

type Invitacion = { id: string; grupo_id: string; email_invitado: string; rol: string; estado: string; expira_en: string | null; grupo_nombre: string | null };

export default function AceptarInvitacionPage() {
  const { session, reintentarPerfil } = useAuthSpendWise();
  const [token, setToken] = useState('');
  const [invitacion, setInvitacion] = useState<Invitacion | null>(null);
  const [grupoAceptado, setGrupoAceptado] = useState<{ id: string; nombre: string } | null>(null);
  const [mensaje, setMensaje] = useState('Cargando invitación...');
  const [aceptando, setAceptando] = useState(false);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => { setToken(new URLSearchParams(window.location.search).get('token') ?? ''); }, []);
  useEffect(() => {
    if (!token) { setMensaje('Esta invitación ya no está disponible.'); return; }
    if (!session) { setMensaje('Iniciá sesión o creá una cuenta con el email invitado para continuar.'); return; }
    void (async () => {
      const { data, error } = await supabase.rpc('consultar_invitacion_grupo', { token_invitacion: token }).maybeSingle();
      const invitacionConsultada = data as Invitacion | null;
      if (error || !invitacionConsultada || invitacionConsultada.estado !== 'pendiente' || (invitacionConsultada.expira_en && new Date(invitacionConsultada.expira_en) <= new Date())) {
        setInvitacion(null); setMensaje('Esta invitación ya no está disponible.'); return;
      }
      if (invitacionConsultada.email_invitado.toLowerCase() !== session.user.email?.toLowerCase()) {
        setInvitacion(null); setMensaje('Esta invitación pertenece a otro email.'); return;
      }
      setInvitacion(invitacionConsultada); setMensaje('La invitación está lista para aceptar.');
    })();
  }, [session, token]);

  async function aceptar() {
    if (!invitacion || !session) return;
    setAceptando(true);
    const { error } = await supabase.from('invitaciones_grupo').update({ estado: 'aceptada', aceptado_por: session.user.id }).eq('id', invitacion.id).eq('estado', 'pendiente');
    if (error) {
      console.error('Error aceptando invitación', error);
      setMensaje(error.message.includes('otro email') ? 'Esta invitación pertenece a otro email.' : 'Esta invitación ya no está disponible.');
      setAceptando(false);
      return;
    }
    setGrupoAceptado({ id: invitacion.grupo_id, nombre: invitacion.grupo_nombre ?? 'Grupo invitado' });
    setInvitacion(null);
    setMensaje('Te uniste al grupo. Podés cambiar de grupo desde el selector.');
    setAceptando(false);
  }

  async function cambiarAhora() {
    if (!grupoAceptado) return;
    setCambiando(true);
    const { error } = await supabase.rpc('cambiar_grupo_activo', { nuevo_grupo_id: grupoAceptado.id });
    if (error) {
      console.error('Error cambiando al grupo invitado', error);
      setMensaje('Te uniste al grupo, pero no se pudo cambiar el grupo activo. Usá el selector de grupo.');
      setCambiando(false);
      return;
    }
    limpiarPerfilActivoCache();
    await reintentarPerfil();
    window.location.assign('/configuracion/grupo');
  }

  const retorno = `/aceptar-invitacion?token=${encodeURIComponent(token)}`;
  return <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-[var(--surface)] p-6 shadow-sm"><h1 className="text-2xl font-semibold">Aceptar invitación a SpendFlow Planner</h1><p className="mt-2 text-sm text-slate-600">Te invitaron a un grupo en SpendFlow Planner.</p><p className="mt-3 text-sm text-slate-600">{mensaje}</p>{invitacion && <div className="mt-5 rounded-xl bg-[var(--surface-2)] p-4 text-sm"><p><span className="text-slate-500">Grupo:</span> <strong>{invitacion.grupo_nombre ?? 'Grupo invitado'}</strong></p><p className="mt-1"><span className="text-slate-500">Email:</span> {invitacion.email_invitado}</p><p className="mt-1"><span className="text-slate-500">Rol:</span> {invitacion.rol}</p><button type="button" onClick={() => void aceptar()} disabled={aceptando} className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">{aceptando ? 'Aceptando...' : 'Unirme al grupo'}</button></div>}{grupoAceptado && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-medium text-emerald-800">Ahora también pertenecés a {grupoAceptado.nombre}.</p><button type="button" onClick={() => void cambiarAhora()} disabled={cambiando} className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-60">{cambiando ? 'Cambiando...' : 'Cambiar a este grupo ahora'}</button><Link href="/configuracion/grupo" className="mt-2 block text-center text-sm font-medium text-emerald-700">Mantener mi grupo activo</Link></div>}{!session && token && <div className="mt-5 flex gap-3"><Link href={`/login?retorno=${encodeURIComponent(retorno)}`} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-center font-medium text-white">Iniciar sesión</Link><Link href={`/registro?retorno=${encodeURIComponent(retorno)}`} className="flex-1 rounded-lg border border-emerald-600 px-4 py-2 text-center font-medium text-emerald-700">Crear cuenta</Link></div>}</section>;
}
