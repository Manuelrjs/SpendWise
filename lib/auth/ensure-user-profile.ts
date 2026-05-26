import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type Perfil = {
  id: string;
  familia_id: string | null;
  email: string | null;
};

const ERROR_PERFIL = 'No se pudo cargar tu perfil. Intentá cerrar sesión e ingresar nuevamente.';

function nombreFamiliaPorDefecto(email?: string | null) {
  const base = email?.split('@')[0]?.trim();
  return base ? `Familia de ${base}` : 'Mi familia';
}

async function crearFamiliaPorDefecto(email?: string | null) {
  const { data, error } = await supabase
    .from('familias')
    .insert({ nombre: nombreFamiliaPorDefecto(email) })
    .select('id')
    .single();

  if (error || !data?.id) {
    console.error('Error creando familia por defecto', {
      code: error?.code,
      message: error?.message,
    });
    throw new Error(ERROR_PERFIL);
  }

  return data.id as string;
}

export async function ensureUserProfile(user: User): Promise<Perfil> {
  const { data: perfilActual, error: errorPerfilActual } = await supabase
    .from('perfiles')
    .select('id,familia_id,email')
    .eq('id', user.id)
    .maybeSingle();

  if (errorPerfilActual) {
    console.error('Error cargando perfil', {
      code: errorPerfilActual.code,
      message: errorPerfilActual.message,
    });
    throw new Error(ERROR_PERFIL);
  }

  if (perfilActual?.familia_id) {
    return perfilActual;
  }

  const familiaId = await crearFamiliaPorDefecto(user.email);

  if (!perfilActual) {
    const { data: perfilCreado, error: errorPerfilCreado } = await supabase
      .from('perfiles')
      .insert({
        id: user.id,
        familia_id: familiaId,
        email: user.email ?? null,
        nombre: user.user_metadata?.nombre ?? user.email?.split('@')[0] ?? 'Usuario',
        rol: 'admin',
      })
      .select('id,familia_id,email')
      .single();

    if (errorPerfilCreado || !perfilCreado) {
      console.error('Error creando perfil', {
        code: errorPerfilCreado?.code,
        message: errorPerfilCreado?.message,
      });
      throw new Error(ERROR_PERFIL);
    }

    return perfilCreado;
  }

  const { data: perfilActualizado, error: errorPerfilActualizado } = await supabase
    .from('perfiles')
    .update({ familia_id: familiaId, email: perfilActual.email ?? user.email ?? null })
    .eq('id', user.id)
    .select('id,familia_id,email')
    .single();

  if (errorPerfilActualizado || !perfilActualizado) {
    console.error('Error actualizando perfil con familia', {
      code: errorPerfilActualizado?.code,
      message: errorPerfilActualizado?.message,
    });
    throw new Error(ERROR_PERFIL);
  }

  return perfilActualizado;
}
