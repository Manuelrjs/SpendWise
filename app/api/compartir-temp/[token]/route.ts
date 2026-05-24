import { NextRequest, NextResponse } from 'next/server';
import { consumirComprobanteCompartido } from '@/lib/server/comprobante-compartido-store';

export function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const compartido = consumirComprobanteCompartido(params.token);
  if (!compartido) {
    return NextResponse.json({ error: 'Comprobante compartido no disponible o vencido.' }, { status: 404 });
  }

  return new NextResponse(compartido.bytes, {
    status: 200,
    headers: {
      'Content-Type': compartido.tipo,
      'Content-Disposition': `inline; filename="${encodeURIComponent(compartido.nombre)}"`,
      'Cache-Control': 'no-store',
      'X-Shared-Filename': encodeURIComponent(compartido.nombre),
    },
  });
}
