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
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">SpendFlow Planner</h1>
      <p className="mt-1 text-sm text-slate-600">Gastos, cuotas y compromisos futuros</p>
      <p className="mt-4 text-sm text-slate-700">{mensaje}</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input className="w-full rounded-lg border p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border p-2" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={loading} className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">
          {loading ? 'Ingresando...' : 'Iniciar sesión'}
        </button>
      </form>
      <Link href={`/registro?retorno=${encodeURIComponent(retorno)}`} className="mt-3 inline-block text-sm text-emerald-700">Crear cuenta</Link>
    </section>
  );
}
