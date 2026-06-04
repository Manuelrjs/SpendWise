import { supabase } from '@/lib/supabase/client';

export type PerfilActivo = {
  userId: string;
  email: string | null;
  grupo_id: string;
  grupo_nombre: string | null;
};

let perfilActivoCache: PerfilActivo | null = null;
let cargaPerfilActivoEnCurso: Promise<PerfilActivo> | null = null;
let usuarioCargaPerfilActivoEnCurso: string | null = null;

export function obtenerPerfilActivoCacheado() {
  return perfilActivoCache;
}

export function guardarPerfilActivoCache(perfil: PerfilActivo | null) {
  perfilActivoCache = perfil;
}

export function limpiarPerfilActivoCache() {
  perfilActivoCache = null;
  cargaPerfilActivoEnCurso = null;
  usuarioCargaPerfilActivoEnCurso = null;
}

export async function obtenerPerfilActivo(userId?: string, email?: string | null): Promise<PerfilActivo> {
  if (perfilActivoCache && (!userId || perfilActivoCache.userId === userId)) {
    return perfilActivoCache;
  }

  if (cargaPerfilActivoEnCurso && (!userId || usuarioCargaPerfilActivoEnCurso === userId)) return cargaPerfilActivoEnCurso;

  cargaPerfilActivoEnCurso = (async () => {
    const usuarioId = userId ?? (await supabase.auth.getUser()).data.user?.id;
    usuarioCargaPerfilActivoEnCurso = usuarioId ?? null;
    if (!usuarioId) throw new Error('No hay sesión activa.');

    const { data: perfil, error: perfilError } = await supabase
      .from('perfiles')
      .select('id,email,grupo_id,grupos:grupo_id(nombre)')
      .eq('id', usuarioId)
      .maybeSingle();

    if (perfilError || !perfil?.grupo_id) {
      throw new Error('No se pudo cargar tu perfil o grupo. Cerrá sesión e intentá nuevamente.');
    }

    const grupoNombre = Array.isArray(perfil.grupos)
      ? perfil.grupos[0]?.nombre ?? null
      : (perfil.grupos as { nombre?: string } | null)?.nombre ?? null;

    const perfilActivo = {
      userId: usuarioId,
      email: perfil.email ?? email ?? null,
      grupo_id: perfil.grupo_id,
      grupo_nombre: grupoNombre,
    };

    perfilActivoCache = perfilActivo;
    return perfilActivo;
  })();

  try {
    return await cargaPerfilActivoEnCurso;
  } finally {
    cargaPerfilActivoEnCurso = null;
    usuarioCargaPerfilActivoEnCurso = null;
  }
}
