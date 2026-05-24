import { NextRequest, NextResponse } from 'next/server';
import { guardarComprobanteCompartido } from '@/lib/server/comprobante-compartido-store';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const archivo = formData.get('comprobante');
  const title = formData.get('title')?.toString() ?? '';
  const text = formData.get('text')?.toString() ?? '';
  const url = formData.get('url')?.toString() ?? '';

  const destino = new URL('/gastos/nuevo?shared=1', request.url);
  if (title) destino.searchParams.set('shared_title', title);
  if (text) destino.searchParams.set('shared_text', text);
  if (url) destino.searchParams.set('shared_url', url);

  if (archivo instanceof File && archivo.size > 0) {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const token = guardarComprobanteCompartido({
      nombre: archivo.name || 'comprobante-compartido',
      tipo: archivo.type || 'application/octet-stream',
      bytes,
    });
    destino.searchParams.set('shared_token', token);
  }

  return NextResponse.redirect(destino, { status: 303 });
}
