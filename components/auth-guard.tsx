'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

const RUTAS_PUBLICAS = new Set(['/login', '/registro']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cargando, setCargando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const verificar = async () => {
      const { data } = await supabase.auth.getSession();
      const sesion = data.session;
      if (!sesion && !RUTAS_PUBLICAS.has(pathname)) {
        router.replace('/login');
      }
      if (sesion && RUTAS_PUBLICAS.has(pathname)) {
        router.replace('/');
      }
      setEmail(sesion?.user.email ?? null);
      setCargando(false);
    };
    void verificar();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
      if (!session && !RUTAS_PUBLICAS.has(pathname)) router.replace('/login');
    });
    return () => listener.subscription.unsubscribe();
  }, [pathname, router]);

  if (cargando && !RUTAS_PUBLICAS.has(pathname)) return <div className="p-6 text-sm text-slate-500">Cargando sesión...</div>;

  return (
    <div>
      {email && !RUTAS_PUBLICAS.has(pathname) ? <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">Sesión activa: {email}</div> : null}
      {children}
    </div>
  );
}
