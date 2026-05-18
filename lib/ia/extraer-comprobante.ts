export type ItemMapeo = { id: string; nombre: string; tipo?: string | null };

export type DatosComprobanteSugeridos = {
  fecha_gasto?: string;
  establecimiento?: string;
  monto?: number;
  moneda?: string;
  categoria_sugerida?: string;
  categoria_id?: string;
  medio_pago_sugerido?: string;
  medio_pago_id?: string;
  identificador_fiscal?: string;
  descripcion?: string;
  observaciones?: string;
  confianza?: number;
  advertencias?: string[];
};

function normalizarTexto(valor: string) {
  return valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function distanciaLevenshtein(a: string, b: string) {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const matriz = Array.from({ length: filas }, () => Array.from<number>({ length: columnas }).fill(0));
  for (let i = 0; i < filas; i += 1) matriz[i][0] = i;
  for (let j = 0; j < columnas; j += 1) matriz[0][j] = j;
  for (let i = 1; i < filas; i += 1) {
    for (let j = 1; j < columnas; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      matriz[i][j] = Math.min(matriz[i - 1][j] + 1, matriz[i][j - 1] + 1, matriz[i - 1][j - 1] + costo);
    }
  }
  return matriz[filas - 1][columnas - 1];
}

function similitudTexto(a: string, b: string) {
  const textoA = normalizarTexto(a);
  const textoB = normalizarTexto(b);
  if (!textoA || !textoB) return 0;
  if (textoA.includes(textoB) || textoB.includes(textoA)) return 1;
  const distancia = distanciaLevenshtein(textoA, textoB);
  const maximo = Math.max(textoA.length, textoB.length);
  return maximo === 0 ? 0 : 1 - distancia / maximo;
}

function mapearPorNombre(nombreSugerido: string | undefined, opciones: ItemMapeo[], umbral = 0.7) {
  if (!nombreSugerido) return { id: undefined as string | undefined, nombre: undefined as string | undefined };
  const mejor = opciones.map((opcion) => ({ ...opcion, score: similitudTexto(nombreSugerido, opcion.nombre) })).sort((a, b) => b.score - a.score)[0];
  if (!mejor || mejor.score < umbral) return { id: undefined, nombre: nombreSugerido };
  return { id: mejor.id, nombre: mejor.nombre };
}

export async function extraerDatosComprobante(params: { file: File; categorias: ItemMapeo[]; mediosPago: ItemMapeo[] }): Promise<DatosComprobanteSugeridos> {
  const { file, categorias, mediosPago } = params;
  const body = new FormData();
  body.append('archivo', file);

  const respuesta = await fetch('/api/comprobantes/analizar', { method: 'POST', body });
  const resultado = (await respuesta.json()) as { sugerencias?: DatosComprobanteSugeridos; mensaje?: string; advertencias?: string[] };

  if (!respuesta.ok || !resultado.sugerencias) {
    throw new Error(resultado.mensaje ?? 'No se pudo analizar el comprobante. Podés cargar el gasto manualmente.');
  }

  const sugerencias = resultado.sugerencias;
  const mapeoCategoria = mapearPorNombre(sugerencias.categoria_sugerida, categorias);
  const mapeoMedio = mapearPorNombre(sugerencias.medio_pago_sugerido, mediosPago);

  return {
    ...sugerencias,
    categoria_id: mapeoCategoria.id,
    categoria_sugerida: mapeoCategoria.nombre ?? sugerencias.categoria_sugerida,
    medio_pago_id: mapeoMedio.id,
    medio_pago_sugerido: mapeoMedio.nombre ?? sugerencias.medio_pago_sugerido,
    advertencias: [...(resultado.advertencias ?? []), ...(sugerencias.advertencias ?? [])],
  };
}
