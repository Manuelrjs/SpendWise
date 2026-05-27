import { supabase } from '@/lib/supabase/client';

export type PerfilActivo = {
  userId: string;
  email: string | null;
  grupo_id: string;
  grupo_nombre: string | null;
};

export async function obtenerPerfilActivo(): Promise<PerfilActivo> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.id) throw new Error('No hay sesión activa.');

  const { data: perfil, error: perfilError } = await supabase
    .from('perfiles')
    .select('id,email,grupo_id,grupos:grupo_id(nombre)')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (perfilError || !perfil?.grupo_id) {
    throw new Error('No se pudo cargar tu perfil o grupo. Cerrá sesión e intentá nuevamente.');
  }

  const grupoNombre = Array.isArray(perfil.grupos)
    ? perfil.grupos[0]?.nombre ?? null
    : (perfil.grupos as { nombre?: string } | null)?.nombre ?? null;

  return {
    userId: authData.user.id,
    email: perfil.email ?? authData.user.email ?? null,
    grupo_id: perfil.grupo_id,
    grupo_nombre: grupoNombre,
  };
}
