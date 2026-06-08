'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ensureUserProfile } from '@/lib/auth/ensure-user-profile';

function mapearErrorLogin(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? '').toLowerCase();
  const code = (error?.code ?? '').toLowerCase();

  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Tu email todavía no está confirmado. Revisá tu correo o confirmá el usuario desde Supabase para desarrollo.';
  }

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }

  return 'No se pudo iniciar sesión. Intentá nuevamente.';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('Ingresá para continuar.');
  const [loading, setLoading] = useState(false);
  const [retorno, setRetorno] = useState('/');

  useEffect(() => {
    const destino = new URLSearchParams(window.location.search).get('retorno');
    if (destino?.startsWith('/') && !destino.startsWith('//')) setRetorno(destino);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMensaje('Validando credenciales...');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.error('Error en signInWithPassword', { code: error.code, message: error.message });
        setMensaje(mapearErrorLogin(error));
        return;
      }

      if (!data.user) {
        setMensaje('No se pudo iniciar sesión. Intentá nuevamente.');
        return;
      }

      await ensureUserProfile(data.user);
      setMensaje('Sesión iniciada correctamente. Redirigiendo...');
      router.replace(retorno);
    } catch (error) {
      console.error('Error inesperado durante login', error);
      setMensaje('No se pudo iniciar sesión. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="sf-auth-shell">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="sf-auth-card">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-900/20">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-none stroke-current stroke-2"><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></svg>
          </span>
          <div><p className="sf-kicker">Control y flujo futuro</p><h1 className="text-2xl font-bold">SpendFlow Planner</h1></div>
        </div>
        <h2 className="text-xl font-semibold">Gastos, cuotas y compromisos futuros</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">Planificá tus pagos y anticipá tu flujo mensual.</p>
        <p className={`mt-5 rounded-xl border px-3 py-2.5 text-sm ${mensaje.includes('incorrectos') || mensaje.includes('No se pudo') ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-100 bg-emerald-50/70 text-emerald-800'}`}>{mensaje}</p>
        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Email<input className="mt-1.5 w-full rounded-xl border px-3 py-2.5" placeholder="tu@email.com" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label className="block text-sm font-semibold text-slate-700">Contraseña<input className="mt-1.5 w-full rounded-xl border px-3 py-2.5" placeholder="Tu contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button disabled={loading} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-sm shadow-emerald-900/20 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">{loading ? 'Ingresando...' : 'Iniciar sesión'}</button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">¿Primera vez? <Link href={`/registro?retorno=${encodeURIComponent(retorno)}`} className="font-semibold text-emerald-700 hover:text-emerald-800">Crear cuenta</Link></p>
      </div>
    </section>
  );
}
