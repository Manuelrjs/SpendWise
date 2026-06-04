'use client';

import type { ErrorTecnico } from '@/lib/errores';

export function ErrorTecnicoDesarrollo({ error }: { error: ErrorTecnico | null }) {
  if (process.env.NODE_ENV === 'production' || !error) return null;

  return (
    <details className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <summary className="cursor-pointer font-semibold">Ver error técnico</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">{JSON.stringify(error, null, 2)}</pre>
    </details>
  );
}
