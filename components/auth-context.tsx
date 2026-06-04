'use client';

import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { PerfilActivo } from '@/lib/auth/grupo-activo';

export type EstadoAuthSpendWise = {
  session: Session | null;
  perfil: PerfilActivo | null;
  perfilLoading: boolean;
  perfilLoaded: boolean;
  creatingProfile: boolean;
  errorPerfil: string | null;
  reintentarPerfil: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const AuthSpendWiseContext = createContext<EstadoAuthSpendWise | null>(null);

export function AuthSpendWiseProvider({ children, value }: { children: React.ReactNode; value: EstadoAuthSpendWise }) {
  return <AuthSpendWiseContext.Provider value={value}>{children}</AuthSpendWiseContext.Provider>;
}

export function useAuthSpendWise() {
  const contexto = useContext(AuthSpendWiseContext);
  if (!contexto) {
    throw new Error('useAuthSpendWise debe usarse dentro de AuthGuard.');
  }

  return contexto;
}
