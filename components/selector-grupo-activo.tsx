'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthSpendWise } from '@/components/auth-context';
import { limpiarPerfilActivoCache } from '@/lib/auth/grupo-activo';
import { supabase } from '@/lib/supabase/client';

type MembresiaGrupo = {
  grupo_id: string;
  rol: 'admin' | 'miembro';
  nombre: string;
};

type SelectorGrupoActivoProps = {
  mostrarTitulo?: boolean;
  onError?: (mensaje: string) => void;
};

export function SelectorGrupoActivo({ mostrarTitulo = false, onError }: SelectorGrupoActivoProps) {
  const { perfil, reintentarPerfil } = useAuthSpendWise();
  const [membresias, setMembresias] = useState<MembresiaGrupo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState(false);

  const cargarMembresias = useCallback(async () => {
    if (!perfil?.userId) return;
    setCargando(true);
    const { data, error } = await supabase
      .from('miembros_grupo')
      .select('grupo_id,rol,grupos:grupo_id(nombre)')
      .eq('usuario_id', perfil.userId)
      .eq('estado', 'activo')
      .order('creado_en');

    if (error) {
      console.error('Error cargando grupos del usuario', error);
      onError?.('No se pudieron cargar tus grupos.');
      setCargando(false);
      return;
    }

    setMembresias((data ?? []).map((membresia) => {
      const grupo = Array.isArray(membresia.grupos) ? membresia.grupos[0] : membresia.grupos;
      return {
        grupo_id: membresia.grupo_id,
        rol: membresia.rol === 'admin' ? 'admin' : 'miembro',
        nombre: grupo?.nombre ?? 'Grupo sin nombre',
      };
    }));
    setCargando(false);
  }, [onError, perfil?.userId]);

  useEffect(() => { void cargarMembresias(); }, [cargarMembresias]);

  async function cambiarGrupo(grupoId: string) {
    if (!perfil || grupoId === perfil.grupo_id) return;
    setCambiando(true);
    const { error } = await supabase.rpc('cambiar_grupo_activo', { nuevo_grupo_id: grupoId });
    if (error) {
      console.error('Error cambiando grupo activo', error);
      onError?.('No se pudo cambiar el grupo activo.');
      setCambiando(false);
      return;
    }

    limpiarPerfilActivoCache();
    await reintentarPerfil();
    window.location.reload();
  }

  if (cargando) return <p className="text-xs text-slate-500">Cargando grupos...</p>;
  if (membresias.length <= 1) {
    return <p className="text-sm font-medium text-slate-700">{membresias[0]?.nombre ?? perfil?.grupo_nombre ?? 'Grupo activo'}</p>;
  }

  return (
    <label className="block text-sm text-slate-600">
      <span className={mostrarTitulo ? 'mb-1 block font-medium' : 'mb-1 block text-xs font-medium'}>Cambiar grupo</span>
      <select
        value={perfil?.grupo_id ?? ''}
        onChange={(evento) => void cambiarGrupo(evento.target.value)}
        disabled={cambiando}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-800 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 disabled:opacity-60"
      >
        {membresias.map((membresia) => <option key={membresia.grupo_id} value={membresia.grupo_id}>{membresia.nombre}</option>)}
      </select>
      {cambiando ? <span className="mt-1 block text-xs text-slate-500">Cambiando grupo...</span> : null}
    </label>
  );
}
