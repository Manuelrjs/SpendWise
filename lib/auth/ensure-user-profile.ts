import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type Perfil = {
  id: string;
  grupo_id: string | null;
  email: string | null;
};

let creacionPerfilEnCurso: Promise<Perfil> | null = null;

const ERROR_PERFIL = 'No se pudo cargar tu perfil o grupo. Intentá nuevamente.';

function nombreGrupoPorDefecto(email?: string | null) {
  const base = email?.split('@')[0]?.trim();
  return base ? `Grupo de ${base}` : 'Grupo de gastos';
}

function nombrePerfilPorDefecto(user: User) {
  return user.user_metadata?.nombre ?? user.email?.split('@')[0] ?? 'Usuario';
}

async function crearGrupoPorDefecto(email?: string | null) {
  const { data, error } = await supabase
    .from('grupos')
    .insert({ nombre: nombreGrupoPorDefecto(email) })
    .select('id')
    .single();

  if (error || !data?.id) {
    console.error('Error creando grupo por defecto', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
    });
    throw new Error(ERROR_PERFIL);
  }

  return data.id as string;
}

export async function ensureUserProfile(user: User): Promise<Perfil> {
  if (!user.id || !user.email) {
    throw new Error('La sesión no tiene id/email válidos para crear el perfil.');
  }

  if (creacionPerfilEnCurso) return creacionPerfilEnCurso;

  creacionPerfilEnCurso = (async () => {
  const { data: perfilActual, error: errorPerfilActual } = await supabase
    .from('perfiles')
    .select('id,grupo_id,email')
    .eq('id', user.id)
    .maybeSingle();

  if (errorPerfilActual) {
    console.error('Error cargando perfil actual', {
      code: errorPerfilActual.code,
      message: errorPerfilActual.message,
      details: errorPerfilActual.details,
    });
    throw new Error(ERROR_PERFIL);
  }

  if (perfilActual?.grupo_id) {
    return perfilActual;
  }

  const grupoId = await crearGrupoPorDefecto(user.email);

  if (!perfilActual) {
    const { data: perfilCreado, error: errorPerfilCreado } = await supabase
      .from('perfiles')
      .insert({
        id: user.id,
        grupo_id: grupoId,
        email: user.email ?? null,
        nombre: nombrePerfilPorDefecto(user),
        rol: 'admin',
      })
      .select('id,grupo_id,email')
      .single();

    if (errorPerfilCreado || !perfilCreado) {
      console.error('Error creando perfil', {
        code: errorPerfilCreado?.code,
        message: errorPerfilCreado?.message,
        details: errorPerfilCreado?.details,
      });
      console.error('Grupo creado sin perfil asociado. Marcar para limpieza manual en mantenimiento.', { grupoId, userId: user.id, email: user.email });
      throw new Error(ERROR_PERFIL);
    }

    return perfilCreado;
  }

  const { data: perfilActualizado, error: errorPerfilActualizado } = await supabase
    .from('perfiles')
    .update({ grupo_id: grupoId, email: perfilActual.email ?? user.email ?? null })
    .eq('id', user.id)
    .select('id,grupo_id,email')
    .single();

  if (errorPerfilActualizado || !perfilActualizado) {
    console.error('Error actualizando perfil sin grupo', {
      code: errorPerfilActualizado?.code,
      message: errorPerfilActualizado?.message,
      details: errorPerfilActualizado?.details,
    });
    throw new Error(ERROR_PERFIL);
  }

  return perfilActualizado;
  })();

  try {
    return await creacionPerfilEnCurso;
  } finally {
    creacionPerfilEnCurso = null;
  }
}
