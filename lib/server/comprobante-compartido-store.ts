import { randomUUID } from 'crypto';

type ComprobanteCompartido = {
  nombre: string;
  tipo: string;
  bytes: Uint8Array;
  creadoEn: number;
};

const TTL_MS = 1000 * 60 * 10;
const store = new Map<string, ComprobanteCompartido>();

function limpiarExpirados() {
  const ahora = Date.now();
  for (const [token, item] of store.entries()) {
    if (ahora - item.creadoEn > TTL_MS) {
      store.delete(token);
    }
  }
}

export function guardarComprobanteCompartido(input: Omit<ComprobanteCompartido, 'creadoEn'>) {
  limpiarExpirados();
  const token = randomUUID();
  store.set(token, { ...input, creadoEn: Date.now() });
  return token;
}

export function consumirComprobanteCompartido(token: string) {
  limpiarExpirados();
  const item = store.get(token);
  if (!item) return null;
  store.delete(token);
  return item;
}
