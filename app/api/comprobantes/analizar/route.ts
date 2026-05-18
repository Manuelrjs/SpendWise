import { NextResponse } from 'next/server';

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

type DatosComprobanteSugeridos = {
  fecha_gasto?: string;
  establecimiento?: string;
  monto?: number;
  moneda?: string;
  categoria_sugerida?: string;
  medio_pago_sugerido?: string;
  identificador_fiscal?: string;
  descripcion?: string;
  observaciones?: string;
  confianza?: number;
  advertencias?: string[];
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get('archivo');

    if (!(archivo instanceof File)) {
      return NextResponse.json({ mensaje: 'No se recibió ningún archivo para analizar.' }, { status: 400 });
    }

    if (archivo.type === 'application/pdf') {
      return NextResponse.json({
        sugerencias: {
          observaciones: 'La lectura automática de PDF se implementará en una fase posterior.',
          advertencias: ['La lectura automática de PDF se implementará en una fase posterior.'],
        } satisfies DatosComprobanteSugeridos,
      });
    }

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      return NextResponse.json({ mensaje: 'Formato no soportado para análisis automático.' }, { status: 400 });
    }

    if (!process.env.IA_COMPROBANTES_ENDPOINT || !process.env.IA_COMPROBANTES_API_KEY) {
      return NextResponse.json({
        sugerencias: {
          observaciones: 'La extracción automática aún no está configurada.',
          advertencias: ['La extracción automática aún no está configurada.'],
        } satisfies DatosComprobanteSugeridos,
      });
    }

    // Placeholder para integración real: mantener server-side para proteger credenciales.
    return NextResponse.json({
      sugerencias: {
        observaciones: 'La extracción automática aún no está configurada.',
        advertencias: ['Configurá IA_COMPROBANTES_ENDPOINT e IA_COMPROBANTES_API_KEY para habilitar OCR/IA real.'],
      } satisfies DatosComprobanteSugeridos,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { mensaje: 'No se pudo analizar el comprobante. Podés cargar el gasto manualmente.' },
      { status: 500 },
    );
  }
}
