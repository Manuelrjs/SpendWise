export const BUCKET_COMPROBANTES = 'comprobantes';
export const TAMANO_MAXIMO_COMPROBANTE_BYTES = 10 * 1024 * 1024;
export const MENSAJE_ERROR_BUCKET_COMPROBANTES = 'No se pudo subir el comprobante. Verificá que el bucket comprobantes exista en Supabase Storage.';
export const TIPOS_ARCHIVO_COMPROBANTE_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type TipoArchivoComprobante = (typeof TIPOS_ARCHIVO_COMPROBANTE_PERMITIDOS)[number];

type CrearRutaStorageParams = {
  grupoId: string;
  gastoId: string;
  nombreArchivo: string;
  fechaGasto?: string | null;
  fechaActual?: Date;
};

export function validarComprobante(archivo: File) {
  const tipoPermitido = TIPOS_ARCHIVO_COMPROBANTE_PERMITIDOS.includes(archivo.type as TipoArchivoComprobante);
  if (!tipoPermitido) {
    return { valido: false, mensaje: 'El comprobante debe ser imagen o PDF.' };
  }
  if (archivo.size > TAMANO_MAXIMO_COMPROBANTE_BYTES) {
    return { valido: false, mensaje: 'El archivo supera el tamaño máximo permitido.' };
  }
  return { valido: true, mensaje: null };
}

export type TipoComprobante = 'imagen' | 'pdf' | 'otro';

export function esImagenTipoArchivo(tipoArchivo: string | null | undefined) {
  return tipoArchivo?.toLowerCase().startsWith('image/') ?? false;
}

export function esPdfTipoArchivo(tipoArchivo: string | null | undefined) {
  return tipoArchivo?.toLowerCase() === 'application/pdf';
}

export function detectarTipoComprobante(archivo: Pick<File, 'type' | 'name'>): TipoComprobante {
  const tipo = archivo.type.toLowerCase();
  const nombre = archivo.name.toLowerCase();
  if (tipo.startsWith('image/')) return 'imagen';
  if (tipo === 'application/pdf' || nombre.endsWith('.pdf')) return 'pdf';
  return 'otro';
}

export function normalizarNombreArchivo(nombreArchivo: string) {
  const nombreSinRuta = nombreArchivo.split(/[\\/]/).pop() ?? 'comprobante';
  const nombreNormalizado = nombreSinRuta
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return nombreNormalizado || 'comprobante';
}

function obtenerFechaParaRuta(fechaGasto?: string | null, fechaActual = new Date()) {
  if (!fechaGasto) return fechaActual;
  const fecha = new Date(`${fechaGasto}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? fechaActual : fecha;
}

export function crearRutaStorageComprobante({ grupoId, gastoId, nombreArchivo, fechaGasto, fechaActual }: CrearRutaStorageParams) {
  const fecha = obtenerFechaParaRuta(fechaGasto, fechaActual);
  const anio = String(fecha.getFullYear());
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const nombreSeguro = normalizarNombreArchivo(nombreArchivo);
  const sufijoUnico = `${Date.now()}-${crypto.randomUUID()}`;
  return `${grupoId}/${anio}/${mes}/${gastoId}/${sufijoUnico}-${nombreSeguro}`;
}

export function pathComprobantePerteneceAGrupo(rutaStorage: string | null | undefined, grupoId: string | null | undefined) {
  if (!rutaStorage || !grupoId) return false;
  return rutaStorage.split('/')[0] === grupoId;
}

export function obtenerNombreArchivoDesdeRuta(rutaStorage: string) {
  return rutaStorage.split('/').pop() ?? normalizarNombreArchivo(rutaStorage);
}
