export const TAMANO_MAXIMO_COMPROBANTE_BYTES = 10 * 1024 * 1024;
export const MENSAJE_ERROR_BUCKET_COMPROBANTES = 'No se pudo subir el comprobante. Verificá que el bucket comprobantes exista en Supabase Storage.';
const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export function validarComprobante(archivo: File) {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return { valido: false, mensaje: 'El comprobante debe ser imagen o PDF.' };
  }
  if (archivo.size > TAMANO_MAXIMO_COMPROBANTE_BYTES) {
    return { valido: false, mensaje: 'El archivo supera el tamaño máximo permitido.' };
  }
  return { valido: true, mensaje: null };
}

export function normalizarNombreArchivo(nombreArchivo: string) {
  return nombreArchivo.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-+/g, '-');
}
