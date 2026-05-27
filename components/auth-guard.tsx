'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { ensureUserProfile } from '@/lib/auth/ensure-user-profile';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';

const RUTAS_PUBLICAS = new Set(['/login', '/registro']);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [nombreGrupo, setNombreGrupo] = useState<string | null>(null);

  const repararPerfil = async (session: Session | null) => {
    if (!session) return;
    setCargandoPerfil(true);
    setErrorPerfil(null);
    try {
      await ensureUserProfile(session.user);
      router.refresh();
    } catch (error) {
      console.error('Error reparando perfil desde botón', error);
      setErrorPerfil('No se pudo cargar tu perfil o grupo. Revisá la migración y volvé a intentar.');
    } finally {
      setCargandoPerfil(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const procesarSesion = async (session: Session | null) => {
      if (!mounted) return;
      setEmail(session?.user.email ?? null);
      setNombreGrupo(null);

      if (!session) {
        setErrorPerfil(null);
        setCargandoPerfil(false);
        if (!RUTAS_PUBLICAS.has(pathname)) router.replace('/login');
        return;
      }

      if (RUTAS_PUBLICAS.has(pathname)) {
        router.replace('/');
      }

      setCargandoPerfil(true);
      setErrorPerfil(null);

      try {
        await ensureUserProfile(session.user);
        const perfil = await obtenerPerfilActivo();
        setNombreGrupo(perfil.grupo_nombre);
      } catch (error) {
        console.error('Error validando perfil en AuthGuard', error);
        setErrorPerfil('No se pudo cargar tu perfil o grupo. Intentá cerrar sesión e ingresar nuevamente.');
      } finally {
        if (mounted) setCargandoPerfil(false);
      }
    };

    const inicializar = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error obteniendo sesión', { code: error.code, message: error.message });
        }
        await procesarSesion(data.session);
      } finally {
        if (mounted) setCargandoSesion(false);
      }
    };

    void inicializar();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void procesarSesion(session);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (!RUTAS_PUBLICAS.has(pathname) && (cargandoSesion || cargandoPerfil)) {
    return <div className="p-6 text-sm text-slate-500">Cargando perfil...</div>;
  }

  return (
    <div>
      {errorPerfil && !RUTAS_PUBLICAS.has(pathname) ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
          <p>{errorPerfil}</p>
          <button
            type="button"
            onClick={async () => {
              const { data } = await supabase.auth.getSession();
              await repararPerfil(data.session);
            }}
            className="mt-2 rounded-md border border-rose-300 bg-white px-3 py-1 font-medium text-rose-700 hover:bg-rose-100"
          >
            Crear mi perfil
          </button>
        </div>
      ) : null}
      {email && !RUTAS_PUBLICAS.has(pathname) ? <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">Grupo activo: {nombreGrupo ?? 'Grupo activo'} · Sesión: {email}</div> : null}
      {children}
    </div>
  );
}
