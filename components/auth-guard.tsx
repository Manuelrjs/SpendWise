'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { ensureUserProfile } from '@/lib/auth/ensure-user-profile';
import {
  guardarPerfilActivoCache,
  limpiarPerfilActivoCache,
  obtenerPerfilActivo,
  obtenerPerfilActivoCacheado,
  type PerfilActivo,
} from '@/lib/auth/grupo-activo';
import { AuthSpendWiseProvider } from '@/components/auth-context';
import { SelectorGrupoActivo } from '@/components/selector-grupo-activo';
import { ErrorTecnicoDesarrollo } from '@/components/error-tecnico-desarrollo';
import { registrarErrorSpendWise, type ErrorTecnico } from '@/lib/errores';

const RUTAS_PUBLICAS = new Set(['/login', '/registro', '/aceptar-invitacion']);
const RUTAS_SOLO_SIN_SESION = new Set(['/login', '/registro']);
const TIEMPO_AVISO_CONEXION_MS = 3000;
const TIEMPO_MOSTRAR_REINTENTO_MS = 8000;

function debugAuth(mensaje: string, datos?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'production') console.debug(`[debug] auth: ${mensaje}`, datos ?? {});
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [perfilLoading, setPerfilLoading] = useState(false);
  const [perfilLoaded, setPerfilLoaded] = useState(false);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState<string | null>(null);
  const [errorTecnico, setErrorTecnico] = useState<ErrorTecnico | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilActivo | null>(obtenerPerfilActivoCacheado());
  const [mostrarAvisoConexion, setMostrarAvisoConexion] = useState(false);
  const [mostrarBotonReintento, setMostrarBotonReintento] = useState(false);

  const cargaPerfilEnCurso = useRef<Promise<PerfilActivo | null> | null>(null);
  const usuarioPerfilEnCurso = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const perfilActualRef = useRef(perfil);
  const perfilLoadedRef = useRef(perfilLoaded);
  const sessionRef = useRef(session);

  useEffect(() => {
    perfilActualRef.current = perfil;
  }, [perfil]);

  useEffect(() => {
    perfilLoadedRef.current = perfilLoaded;
  }, [perfilLoaded]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!cargandoSesion && !perfilLoading) {
      setMostrarAvisoConexion(false);
      setMostrarBotonReintento(false);
      return;
    }

    const aviso = window.setTimeout(() => setMostrarAvisoConexion(true), TIEMPO_AVISO_CONEXION_MS);
    const reintento = window.setTimeout(() => setMostrarBotonReintento(true), TIEMPO_MOSTRAR_REINTENTO_MS);

    return () => {
      window.clearTimeout(aviso);
      window.clearTimeout(reintento);
    };
  }, [cargandoSesion, perfilLoading]);

  const cargarPerfilSiHaceFalta = useCallback(async (user: User, forzar = false) => {
    const perfilCacheado = obtenerPerfilActivoCacheado();
    if (!forzar && perfilLoadedRef.current && perfilActualRef.current?.userId === user.id) {
      debugAuth('perfil ya estaba cargado en contexto', { userId: user.id, grupo_id: perfilActualRef.current.grupo_id });
      return perfilActualRef.current;
    }

    if (!forzar && perfilCacheado?.userId === user.id) {
      debugAuth('perfil recuperado desde cache', { userId: user.id, grupo_id: perfilCacheado.grupo_id });
      setPerfil(perfilCacheado);
      setPerfilLoaded(true);
      return perfilCacheado;
    }

    if (cargaPerfilEnCurso.current && usuarioPerfilEnCurso.current === user.id) {
      debugAuth('carga de perfil ya en curso', { userId: user.id });
      return cargaPerfilEnCurso.current;
    }

    usuarioPerfilEnCurso.current = user.id;
    setPerfilLoading(true);
    setCreatingProfile(true);
    setErrorPerfil(null);
    setErrorTecnico(null);
    debugAuth('inicio carga perfil', { userId: user.id, email: user.email });

    cargaPerfilEnCurso.current = (async () => {
      await ensureUserProfile(user);
      const perfilActivo = await obtenerPerfilActivo(user.id, user.email ?? null);
      guardarPerfilActivoCache(perfilActivo);
      debugAuth('perfil encontrado', { userId: user.id, grupo_id: perfilActivo.grupo_id });
      debugAuth('grupo encontrado', { grupo_id: perfilActivo.grupo_id, grupo_nombre: perfilActivo.grupo_nombre });
      return perfilActivo;
    })();

    try {
      const perfilActivo = await cargaPerfilEnCurso.current;
      if (!mountedRef.current) return perfilActivo;
      setPerfil(perfilActivo);
      setPerfilLoaded(true);
      return perfilActivo;
    } catch (error) {
      const detalle = registrarErrorSpendWise('auth-guard', error);
      if (mountedRef.current) {
        setPerfil(null);
        setPerfilLoaded(false);
        setErrorTecnico(detalle);
        setErrorPerfil('No se pudo cargar tu perfil o grupo. Revisá la conexión con Supabase e intentá nuevamente.');
      }
      console.error('Error validando perfil en AuthGuard', error);
      return null;
    } finally {
      if (mountedRef.current) {
        setPerfilLoading(false);
        setCreatingProfile(false);
      }
      cargaPerfilEnCurso.current = null;
      usuarioPerfilEnCurso.current = null;
    }
  }, []);

  const procesarSesion = useCallback(async (sessionActual: Session | null) => {
    if (!mountedRef.current) return;
    setSession(sessionActual);

    if (!sessionActual) {
      debugAuth('sin sesión activa');
      limpiarPerfilActivoCache();
      setPerfil(null);
      setPerfilLoaded(false);
      setPerfilLoading(false);
      setCreatingProfile(false);
      setErrorPerfil(null);
      setErrorTecnico(null);
      return;
    }

    debugAuth('sesión encontrada', { userId: sessionActual.user.id, email: sessionActual.user.email });
    await cargarPerfilSiHaceFalta(sessionActual.user);
  }, [cargarPerfilSiHaceFalta]);

  useEffect(() => {
    mountedRef.current = true;

    const inicializar = async () => {
      debugAuth('inicio carga sesión');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          const detalle = registrarErrorSpendWise('auth-session', error);
          console.error('Error obteniendo sesión', { code: error.code, message: error.message });
          if (mountedRef.current) {
            setErrorTecnico(detalle);
            setErrorPerfil('No se pudo verificar tu sesión. Revisá la conexión con Supabase.');
          }
        }
        await procesarSesion(data.session);
      } finally {
        if (mountedRef.current) setCargandoSesion(false);
      }
    };

    void inicializar();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, sessionActual) => {
      if (_event === 'INITIAL_SESSION') return;
      void procesarSesion(sessionActual);
    });

    return () => {
      mountedRef.current = false;
      listener.subscription.unsubscribe();
    };
  }, [procesarSesion]);

  useEffect(() => {
    const esPublica = RUTAS_PUBLICAS.has(pathname);
    if (!cargandoSesion && !session && !esPublica) router.replace('/login');
    if (!cargandoSesion && session && RUTAS_SOLO_SIN_SESION.has(pathname)) {
      const retorno = new URLSearchParams(window.location.search).get('retorno');
      router.replace(retorno?.startsWith('/') && !retorno.startsWith('//') ? retorno : '/');
    }
  }, [cargandoSesion, pathname, router, session]);

  const reintentarPerfil = useCallback(async () => {
    const sessionActual = sessionRef.current ?? (await supabase.auth.getSession()).data.session;
    setMostrarAvisoConexion(false);
    setMostrarBotonReintento(false);
    if (!sessionActual) {
      router.replace('/login');
      return;
    }

    limpiarPerfilActivoCache();
    await cargarPerfilSiHaceFalta(sessionActual.user, true);
  }, [cargarPerfilSiHaceFalta, router]);

  const cerrarSesion = useCallback(async () => {
    limpiarPerfilActivoCache();
    await supabase.auth.signOut();
    router.replace('/login');
  }, [router]);

  const valorContexto = useMemo(() => ({
    session,
    perfil,
    perfilLoading,
    perfilLoaded,
    creatingProfile,
    errorPerfil,
    reintentarPerfil,
    cerrarSesion,
  }), [cerrarSesion, creatingProfile, errorPerfil, perfil, perfilLoaded, perfilLoading, reintentarPerfil, session]);

  const esRutaPublica = RUTAS_PUBLICAS.has(pathname);
  const bloqueaRutaPrivada = !esRutaPublica && (cargandoSesion || perfilLoading || (!perfilLoaded && !errorPerfil));

  if (bloqueaRutaPrivada) {
    return (
      <PantallaCargaInicial
        mostrarAvisoConexion={mostrarAvisoConexion}
        mostrarBotonReintento={mostrarBotonReintento}
        onReintentar={reintentarPerfil}
      />
    );
  }

  return (
    <AuthSpendWiseProvider value={valorContexto}>
      <div>
        {errorPerfil && !esRutaPublica ? (
          <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm">
            <p className="font-semibold">No pudimos preparar tu perfil.</p>
            <p className="mt-1">{errorPerfil}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void reintentarPerfil()}
                disabled={perfilLoading}
                className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {perfilLoading ? 'Reintentando...' : 'Reintentar'}
              </button>
              <button
                type="button"
                onClick={() => void cerrarSesion()}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </div>
            <div className="mt-3">
              <ErrorTecnicoDesarrollo error={errorTecnico} />
            </div>
          </div>
        ) : null}
        {perfil?.email && !esRutaPublica ? (
          <div className="mb-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>Grupo activo: <strong>{perfil.grupo_nombre ?? 'Grupo activo'}</strong> · Sesión: {perfil.email}</p>
            <div className="w-full sm:w-64"><SelectorGrupoActivo /></div>
          </div>
        ) : null}
        {children}
      </div>
    </AuthSpendWiseProvider>
  );
}

function PantallaCargaInicial({
  mostrarAvisoConexion,
  mostrarBotonReintento,
  onReintentar,
}: {
  mostrarAvisoConexion: boolean;
  mostrarBotonReintento: boolean;
  onReintentar: () => Promise<void>;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">💸</div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Preparando SpendFlow Planner...</h1>
        <p className="mt-2 text-sm text-slate-600">Cargando tu grupo y datos iniciales...</p>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-emerald-500" />
        </div>
        {mostrarAvisoConexion ? (
          <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
            Esto está tardando más de lo normal. Verificando conexión con Supabase...
          </p>
        ) : null}
        {mostrarBotonReintento ? (
          <button
            type="button"
            onClick={() => void onReintentar()}
            className="mt-4 w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Reintentar carga de perfil
          </button>
        ) : null}
      </section>
    </div>
  );
}
