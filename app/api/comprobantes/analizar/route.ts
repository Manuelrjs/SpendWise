import { NextResponse } from 'next/server';
import { TAMANO_MAXIMO_COMPROBANTE_BYTES } from '@/lib/comprobantes';

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
const OPENAI_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o-mini';

type DatosComprobanteSugeridos = {
  fecha_gasto: string;
  establecimiento: string;
  monto: number | null;
  moneda: string;
  categoria_sugerida: string;
  medio_pago_sugerido: string;
  identificador_fiscal: string;
  descripcion: string;
  observaciones: string;
  confianza: number;
  advertencias: string[];
};

const RESPUESTA_POR_DEFECTO: DatosComprobanteSugeridos = {
  fecha_gasto: '',
  establecimiento: '',
  monto: null,
  moneda: 'ARS',
  categoria_sugerida: '',
  medio_pago_sugerido: '',
  identificador_fiscal: '',
  descripcion: '',
  observaciones: '',
  confianza: 0,
  advertencias: [],
};

function limpiarRespuesta(payload: unknown): DatosComprobanteSugeridos {
  const base = { ...RESPUESTA_POR_DEFECTO };
  if (!payload || typeof payload !== 'object') return base;

  const data = payload as Record<string, unknown>;
  base.fecha_gasto = typeof data.fecha_gasto === 'string' ? data.fecha_gasto : '';
  base.establecimiento = typeof data.establecimiento === 'string' ? data.establecimiento : '';
  base.monto = typeof data.monto === 'number' && Number.isFinite(data.monto) ? data.monto : null;
  base.moneda = typeof data.moneda === 'string' && data.moneda.trim() ? data.moneda.trim() : 'ARS';
  base.categoria_sugerida = typeof data.categoria_sugerida === 'string' ? data.categoria_sugerida : '';
  base.medio_pago_sugerido = typeof data.medio_pago_sugerido === 'string' ? data.medio_pago_sugerido : '';
  base.identificador_fiscal = typeof data.identificador_fiscal === 'string' ? data.identificador_fiscal : '';
  base.descripcion = typeof data.descripcion === 'string' ? data.descripcion : '';
  base.observaciones = typeof data.observaciones === 'string' ? data.observaciones : '';
  base.confianza = typeof data.confianza === 'number' && Number.isFinite(data.confianza)
    ? Math.max(0, Math.min(1, data.confianza))
    : 0;
  base.advertencias = Array.isArray(data.advertencias)
    ? data.advertencias.filter((item): item is string => typeof item === 'string')
    : [];

  return base;
}

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
          ...RESPUESTA_POR_DEFECTO,
          observaciones: 'La lectura automática de PDF se implementará en una fase posterior.',
          advertencias: ['La lectura automática de PDF se implementará en una fase posterior.'],
        } satisfies DatosComprobanteSugeridos,
      });
    }

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      return NextResponse.json({ mensaje: 'Formato no soportado para análisis automático.' }, { status: 400 });
    }

    if (archivo.size > TAMANO_MAXIMO_COMPROBANTE_BYTES) {
      return NextResponse.json({ mensaje: 'El archivo supera el tamaño máximo permitido.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        sugerencias: {
          ...RESPUESTA_POR_DEFECTO,
          observaciones: 'La extracción automática aún no está configurada.',
          advertencias: ['La extracción automática aún no está configurada.'],
        } satisfies DatosComprobanteSugeridos,
      });
    }

    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${archivo.type};base64,${base64}`;

    const prompt = `Analizá la imagen de un comprobante (ticket/factura) y devolvé SOLO JSON válido (sin markdown).
Campos obligatorios:
{
  "fecha_gasto": "YYYY-MM-DD o vacío",
  "establecimiento": "texto o vacío",
  "monto": number o null,
  "moneda": "ARS/USD/etc",
  "categoria_sugerida": "texto o vacío",
  "medio_pago_sugerido": "texto o vacío",
  "identificador_fiscal": "texto o vacío",
  "descripcion": "texto o vacío",
  "observaciones": "texto",
  "confianza": number,
  "advertencias": []
}
Reglas:
- Identificar total final pagado, no subtotal.
- Si hay varios importes, elegir el importe final/total.
- Si no estás seguro en un campo, usar vacío o null y agregar advertencia.
- Normalizar fecha a YYYY-MM-DD si es posible.
- Normalizar moneda a ARS si parece comprobante argentino y no hay otra moneda clara.
- No inventar datos.`;

    const respuestaOpenAI = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: dataUrl },
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
      }),
    });

    if (!respuestaOpenAI.ok) {
      const detalle = await respuestaOpenAI.text();
      console.error('Error OpenAI:', detalle);
      return NextResponse.json(
        { mensaje: 'No se pudo analizar el comprobante. Podés cargar el gasto manualmente.' },
        { status: 502 },
      );
    }

    const data = (await respuestaOpenAI.json()) as { output_text?: string };
    const contenido = data.output_text;

    if (!contenido) {
      return NextResponse.json(
        { mensaje: 'No se pudo analizar el comprobante. Podés cargar el gasto manualmente.' },
        { status: 502 },
      );
    }

    const parsed = JSON.parse(contenido) as unknown;

    return NextResponse.json({ sugerencias: limpiarRespuesta(parsed) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { mensaje: 'No se pudo analizar el comprobante. Podés cargar el gasto manualmente.' },
      { status: 500 },
    );
  }
}
