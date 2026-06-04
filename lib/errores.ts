export type ErrorTecnico = {
  message: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
  raw: unknown;
};

export function normalizarErrorTecnico(error: unknown): ErrorTecnico {
  const errorLike = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown } | null;

  return {
    message: typeof errorLike?.message === 'string' ? errorLike.message : error instanceof Error ? error.message : null,
    code: typeof errorLike?.code === 'string' ? errorLike.code : null,
    details: typeof errorLike?.details === 'string' ? errorLike.details : null,
    hint: typeof errorLike?.hint === 'string' ? errorLike.hint : null,
    raw: error,
  };
}

export function registrarErrorSpendWise(pantalla: string, error: unknown): ErrorTecnico {
  const detalle = normalizarErrorTecnico(error);
  console.error(`[SpendWise][${pantalla}] Error cargando datos`, detalle);
  return detalle;
}
