'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { ensureUserProfile } from '@/lib/auth/ensure-user-profile';

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('Completá tus datos para crear tu cuenta.');
  const [loading, setLoading] = useState(false);
  const [retorno, setRetorno] = useState('/');

  useEffect(() => {
    const destino = new URLSearchParams(window.location.search).get('retorno');
    if (destino?.startsWith('/') && !destino.startsWith('//')) setRetorno(destino);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMensaje('Creando cuenta...');

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        console.error('Error en signUp', { code: error.code, message: error.message });
        setMensaje('No se pudo crear la cuenta. Verificá tus datos e intentá nuevamente.');
        return;
      }

      if (!data.session || !data.user) {
        setMensaje('Cuenta creada. Revisá tu correo para confirmar el acceso.');
        return;
      }

      await ensureUserProfile(data.user);
      setMensaje('Cuenta creada correctamente. Redirigiendo...');
      router.replace(retorno);
    } catch (error) {
      console.error('Error inesperado durante registro', error);
      setMensaje('No se pudo crear la cuenta. Intentá nuevamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold">SpendFlow Planner</h1>
      <p className="mt-1 text-sm text-slate-600">Controlá tus gastos y anticipá tus pagos.</p>
      <h2 className="mt-4 text-lg font-medium">Crear cuenta</h2>
      <p className="mt-2 text-sm">{mensaje}</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input className="w-full rounded-lg border p-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full rounded-lg border p-2" placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button disabled={loading} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70">
          {loading ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
      <Link href={`/login?retorno=${encodeURIComponent(retorno)}`} className="mt-3 inline-block text-sm text-emerald-700">Volver a login</Link>
    </section>
  );
}
