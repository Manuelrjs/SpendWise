export type ItemMapeo = { id: string; nombre: string; tipo?: string | null };

export type DatosComprobanteSugeridos = {
  fecha_gasto?: string;
  establecimiento?: string;
  monto?: number | null;
  moneda?: string;
  categoria_sugerida?: string;
  categoria_id?: string | null;
  medio_pago_sugerido?: string;
  medio_pago_id?: string | null;
  identificador_fiscal?: string;
  descripcion?: string;
  observaciones?: string;
  confianza?: number;
  advertencias?: string[];
  categoria_mapeo_detalle?: string;
  medio_pago_mapeo_detalle?: string;
  categoria_no_aplicada?: string;
  medio_pago_no_aplicado?: string;
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

function contieneAlguno(texto: string, palabras: string[]) {
  return palabras.some((palabra) => texto.includes(palabra));
}

function mapearCategoria(sugerida: string | undefined, establecimiento: string | undefined, categorias: ItemMapeo[]) {
  if (!sugerida) return { id: undefined as string | undefined, nombre: undefined as string | undefined, detalle: undefined as string | undefined, noAplicada: undefined as string | undefined };
  const normalizada = normalizarTexto(sugerida);
  const establecimientoNormalizado = normalizarTexto(establecimiento ?? '');
  const categoriaSupermercado = categorias.find((cat) => normalizarTexto(cat.nombre) === 'supermercado');
  const categoriaComida = categorias.find((cat) => normalizarTexto(cat.nombre) === 'comida');

  const sinonimosSupermercado = ['alimentos', 'supermercado', 'super', 'hipermercado', 'autoservicio', 'almacen', 'despensa', 'grocery', 'groceries', 'mayorista'];
  const sinonimosComida = ['restaurante', 'cafeteria', 'cafe', 'delivery', 'comida preparada', 'fast food', 'bar', 'rotiseria'];

  const pareceSupermercado = contieneAlguno(establecimientoNormalizado, ['super', 'hiper', 'market', 'almacen', 'autoservicio', 'mayorista']);
  const coincideSupermercado = contieneAlguno(normalizada, sinonimosSupermercado);
  const coincideComida = contieneAlguno(normalizada, sinonimosComida);

  if (categoriaSupermercado && (coincideSupermercado || (normalizada === 'alimentos' && pareceSupermercado))) {
    return {
      id: categoriaSupermercado.id,
      nombre: categoriaSupermercado.nombre,
      detalle: `La IA sugirió "${sugerida}", pero se aplicó "${categoriaSupermercado.nombre}" por coincidencia con supermercado/alimentos.`,
      noAplicada: undefined,
    };
  }

  if (categoriaComida && coincideComida && !(normalizada === 'alimentos' && categoriaSupermercado && pareceSupermercado)) {
    return {
      id: categoriaComida.id,
      nombre: categoriaComida.nombre,
      detalle: `La IA sugirió "${sugerida}", pero se aplicó "${categoriaComida.nombre}" por coincidencia con restaurantes/comida preparada.`,
      noAplicada: undefined,
    };
  }

  const exacta = categorias.find((cat) => normalizarTexto(cat.nombre) === normalizada);
  if (exacta) return { id: exacta.id, nombre: exacta.nombre, detalle: undefined, noAplicada: undefined };

  const similitud = mapearPorNombre(sugerida, categorias, 0.86);
  if (similitud.id) {
    return { id: similitud.id, nombre: similitud.nombre, detalle: `Se aplicó "${similitud.nombre}" por similitud clara con "${sugerida}".`, noAplicada: undefined };
  }

  return { id: undefined, nombre: sugerida, detalle: undefined, noAplicada: sugerida };
}

function mapearMedioPago(sugerido: string | undefined, mediosPago: ItemMapeo[]) {
  if (!sugerido) return { id: undefined as string | undefined, nombre: undefined as string | undefined, detalle: undefined as string | undefined, noAplicado: undefined as string | undefined };
  const normalizado = normalizarTexto(sugerido);
  const aliases: Array<{ claves: string[]; destinos: string[]; motivo: string }> = [
    { claves: ['efectivo', 'cash'], destinos: ['efectivo'], motivo: 'coincidencia con efectivo/cash' },
    { claves: ['debito', 'debit card', 'tarjeta debito'], destinos: ['debito'], motivo: 'coincidencia con débito' },
    { claves: ['credito', 'credit card', 'tarjeta credito', 'visa credito', 'mastercard credito'], destinos: ['tarjeta credito', 'credito'], motivo: 'coincidencia con crédito' },
    { claves: ['transferencia', 'bank transfer'], destinos: ['transferencia'], motivo: 'coincidencia con transferencia' },
    { claves: ['mercado pago', 'mercadopago', 'mp', 'billetera'], destinos: ['mercado pago', 'billetera virtual', 'billetera_virtual'], motivo: 'coincidencia con billetera/mercado pago' },
  ];

  for (const alias of aliases) {
    if (!contieneAlguno(normalizado, alias.claves)) continue;
    for (const destino of alias.destinos) {
      const encontrado = mediosPago.find((medio) => normalizarTexto(medio.nombre) === destino);
      if (encontrado) {
        return { id: encontrado.id, nombre: encontrado.nombre, detalle: `Se aplicó "${encontrado.nombre}" por ${alias.motivo}.`, noAplicado: undefined };
      }
    }
  }

  const exacto = mediosPago.find((medio) => normalizarTexto(medio.nombre) === normalizado);
  if (exacto) return { id: exacto.id, nombre: exacto.nombre, detalle: undefined, noAplicado: undefined };
  const similar = mapearPorNombre(sugerido, mediosPago, 0.86);
  if (similar.id) return { id: similar.id, nombre: similar.nombre, detalle: `Se aplicó "${similar.nombre}" por similitud clara con "${sugerido}".`, noAplicado: undefined };
  return { id: undefined, nombre: sugerido, detalle: undefined, noAplicado: sugerido };
}

export async function extraerDatosComprobante(params: { file: File; categorias: ItemMapeo[]; mediosPago: ItemMapeo[] }): Promise<DatosComprobanteSugeridos> {
  const { file, categorias, mediosPago } = params;
  const body = new FormData();
  body.append('archivo', file);

  const respuesta = await fetch('/api/comprobantes/analizar', { method: 'POST', body });
  const resultado = (await respuesta.json()) as {
    sugerencias?: DatosComprobanteSugeridos;
    mensaje?: string;
    error?: string;
    detalle?: string;
    fase?: string;
    advertencias?: string[];
  };

  if (!respuesta.ok || !resultado.sugerencias) {
    const mensajeBase = resultado.error ?? resultado.mensaje ?? 'No se pudo analizar el comprobante. Podés cargar el gasto manualmente.';
    const detalle = resultado.detalle ? ` Detalle: ${resultado.detalle}.` : '';
    const fase = resultado.fase ? ` Fase: ${resultado.fase}.` : '';
    throw new Error(`${mensajeBase}${detalle}${fase}`.trim());
  }

  const sugerencias = resultado.sugerencias;
  const advertencias = [...(resultado.advertencias ?? []), ...(sugerencias.advertencias ?? [])];

  let mapeoCategoria: ReturnType<typeof mapearCategoria> = { id: undefined, nombre: sugerencias.categoria_sugerida, detalle: undefined, noAplicada: undefined };
  try {
    mapeoCategoria = mapearCategoria(sugerencias.categoria_sugerida, sugerencias.establecimiento, categorias);
  } catch (error) {
    console.error('Error en mapeo de categoría de comprobante:', error);
    advertencias.push('La categoría sugerida no se pudo mapear automáticamente.');
  }

  let mapeoMedio: ReturnType<typeof mapearMedioPago> = { id: undefined, nombre: sugerencias.medio_pago_sugerido, detalle: undefined, noAplicado: undefined };
  try {
    mapeoMedio = mapearMedioPago(sugerencias.medio_pago_sugerido, mediosPago);
  } catch (error) {
    console.error('Error en mapeo de medio de pago de comprobante:', error);
    advertencias.push('El medio de pago sugerido no se pudo mapear automáticamente.');
  }

  return {
    ...sugerencias,
    categoria_id: mapeoCategoria.id ?? null,
    categoria_sugerida: mapeoCategoria.nombre ?? sugerencias.categoria_sugerida,
    medio_pago_id: mapeoMedio.id ?? null,
    medio_pago_sugerido: mapeoMedio.nombre ?? sugerencias.medio_pago_sugerido,
    categoria_mapeo_detalle: mapeoCategoria.detalle,
    medio_pago_mapeo_detalle: mapeoMedio.detalle,
    categoria_no_aplicada: mapeoCategoria.noAplicada,
    medio_pago_no_aplicado: mapeoMedio.noAplicado,
    advertencias,
  };
}
