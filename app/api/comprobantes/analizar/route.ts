import { NextResponse } from 'next/server';
import { TAMANO_MAXIMO_COMPROBANTE_BYTES } from '@/lib/comprobantes';

const TIPOS_IMAGEN = ['image/jpg', 'image/jpeg', 'image/png', 'image/webp'];
const TIPO_PDF = 'application/pdf';
const OPENAI_MODEL = 'gpt-4o-mini';
const MENSAJE_ERROR_ANALISIS = 'No se pudo analizar el comprobante';

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
  establecimiento_candidatos: Array<{ nombre: string; tipo: string; confianza: number }>;
  emisor_factura: string;
  receptor_factura: string;
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
  establecimiento_candidatos: [],
  emisor_factura: '',
  receptor_factura: '',
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
  base.establecimiento_candidatos = Array.isArray(data.establecimiento_candidatos)
    ? data.establecimiento_candidatos
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        nombre: typeof item.nombre === 'string' ? item.nombre.trim() : '',
        tipo: typeof item.tipo === 'string' ? item.tipo.trim().toLowerCase() : 'otro',
        confianza: typeof item.confianza === 'number' && Number.isFinite(item.confianza)
          ? Math.max(0, Math.min(1, item.confianza))
          : 0,
      }))
      .filter((item) => item.nombre.length > 0)
    : [];
  base.emisor_factura = typeof data.emisor_factura === 'string' ? data.emisor_factura : '';
  base.receptor_factura = typeof data.receptor_factura === 'string' ? data.receptor_factura : '';

  return base;
}

function limpiarJsonDeMarkdown(texto: string): string {
  const textoLimpio = texto.trim();

  if (!textoLimpio.startsWith('```')) {
    return textoLimpio;
  }

  return textoLimpio
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

type RespuestaOpenAI = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

function resumirRespuestaOpenAI(response: RespuestaOpenAI): Record<string, unknown> {
  return {
    output_text: response.output_text ? `${response.output_text.slice(0, 300)}${response.output_text.length > 300 ? '…' : ''}` : null,
    output: Array.isArray(response.output)
      ? response.output.slice(0, 3).map((item) => ({
        type: item?.type ?? null,
        content: Array.isArray(item?.content)
          ? item.content.slice(0, 5).map((contentItem) => ({
            type: contentItem?.type ?? null,
            text_preview: typeof contentItem?.text === 'string'
              ? `${contentItem.text.slice(0, 200)}${contentItem.text.length > 200 ? '…' : ''}`
              : null,
          }))
          : null,
      }))
      : null,
  };
}

function extraerTextoOpenAI(response: RespuestaOpenAI): string | null {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text;
  }

  if (!Array.isArray(response.output)) {
    return null;
  }

  for (const item of response.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (typeof contentItem?.text !== 'string' || !contentItem.text.trim()) {
        continue;
      }

      if (!contentItem.type || contentItem.type === 'output_text' || contentItem.type === 'text') {
        return contentItem.text;
      }
    }
  }

  return null;
}

function extraerDetalleError(error: unknown): {
  mensaje: string;
  status?: number;
  code?: string;
  type?: string;
  data?: unknown;
  stack?: string;
  name?: string;
} {
  if (error instanceof Error) {
    const e = error as Error & {
      status?: number;
      code?: string;
      type?: string;
      response?: { data?: unknown };
    };

    return {
      mensaje: e.message,
      name: e.name,
      status: e.status,
      code: e.code,
      type: e.type,
      data: e.response?.data,
      stack: e.stack,
    };
  }

  return {
    mensaje: typeof error === 'string' ? error : 'Error desconocido',
  };
}

function construirRespuestaError(detalle: ReturnType<typeof extraerDetalleError>, fase: string) {
  const base = {
    error: MENSAJE_ERROR_ANALISIS,
    detalle: detalle.mensaje,
    fase,
  };

  if (process.env.NODE_ENV === 'production') {
    return base;
  }

  return {
    ...base,
    name: detalle.name,
    status: detalle.status,
    code: detalle.code,
    type: detalle.type,
    stack: detalle.stack,
    data: detalle.data,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const archivo = formData.get('archivo');

    if (!(archivo instanceof File)) {
      const detalle = extraerDetalleError('No se recibió ningún archivo para analizar.');
      console.error('Error analizando comprobante:', detalle);
      return NextResponse.json(construirRespuestaError(detalle, 'validacion'), { status: 400 });
    }

    const esPdf = archivo.type === TIPO_PDF;
    const esImagen = TIPOS_IMAGEN.includes(archivo.type);

    if (!esPdf && !esImagen) {
      const detalle = extraerDetalleError('Formato no soportado para análisis automático.');
      console.error('Error analizando comprobante:', detalle);
      return NextResponse.json(construirRespuestaError(detalle, 'validacion'), { status: 400 });
    }

    if (archivo.size > TAMANO_MAXIMO_COMPROBANTE_BYTES) {
      const detalle = extraerDetalleError('El archivo supera el tamaño máximo permitido.');
      console.error('Error analizando comprobante:', detalle);
      return NextResponse.json(construirRespuestaError(detalle, 'validacion'), { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const detalle = extraerDetalleError('Falta OPENAI_API_KEY');
      console.error('Error analizando comprobante:', detalle);
      return NextResponse.json(construirRespuestaError(detalle, 'validacion'), { status: 500 });
    }

    const bytes = await archivo.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const dataUrl = `data:${archivo.type};base64,${base64}`;
    const prompt = esPdf
      ? `Analizá este comprobante o factura en PDF y devolvé SOLO JSON válido (sin markdown).
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
  "advertencias": [],
  "establecimiento_candidatos": [{ "nombre": "texto", "tipo": "emisor|proveedor|vendedor|comercio|establecimiento|razon_social_emisora|receptor|cliente|comprador|consumidor|facturado_a|destinatario|otro", "confianza": 0.0 }],
  "emisor_factura": "texto o vacío",
  "receptor_factura": "texto o vacío"
}
Reglas:
- Este endpoint es para comprobantes/facturas simples, no para resúmenes de tarjeta.
- Si detectás que parece resumen de tarjeta, indicarlo en advertencias.
- Identificar total final pagado, no subtotal.
- Si hay varios importes, elegir el importe final/total.
- Si no estás seguro en un campo, usar vacío o null y agregar advertencia.
- Normalizar fecha a YYYY-MM-DD si es posible.
- Normalizar moneda a ARS si parece comprobante argentino y no hay otra moneda clara.
- No inventar datos.
- Sugerir categoría y medio de pago como texto libre, sin depender de IDs o catálogos locales.
- Identificar por separado emisor/proveedor/vendedor/comercio/establecimiento/razón social emisora y receptor/cliente/comprador/consumidor/facturado a/destinatario.
- Para "establecimiento", priorizar emisor/proveedor/vendedor/comercio/razón social emisora.
- No usar como "establecimiento" el receptor/cliente salvo que no exista ningún emisor claro.
- No usar "Consumidor Final" como establecimiento.
- Si detectás nombre comercial y razón social del emisor, preferir nombre comercial si es claro.
- Si hay dudas entre más de un nombre, devolver opciones en "establecimiento_candidatos".`
      : `Analizá la imagen de un comprobante (ticket/factura) y devolvé SOLO JSON válido (sin markdown).
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
  "advertencias": [],
  "establecimiento_candidatos": [{ "nombre": "texto", "tipo": "emisor|proveedor|vendedor|comercio|establecimiento|razon_social_emisora|receptor|cliente|comprador|consumidor|facturado_a|destinatario|otro", "confianza": 0.0 }],
  "emisor_factura": "texto o vacío",
  "receptor_factura": "texto o vacío"
}
Reglas:
- Identificar total final pagado, no subtotal.
- Si hay varios importes, elegir el importe final/total.
- Si no estás seguro en un campo, usar vacío o null y agregar advertencia.
- Normalizar fecha a YYYY-MM-DD si es posible.
- Normalizar moneda a ARS si parece comprobante argentino y no hay otra moneda clara.
- No inventar datos.
- Sugerir categoría y medio de pago como texto libre, sin depender de IDs o catálogos locales.
- No forzar categoría o medio de pago con baja confianza.
- Identificar por separado emisor/proveedor/vendedor/comercio/establecimiento/razón social emisora y receptor/cliente/comprador/consumidor/facturado a/destinatario.
- Para "establecimiento", priorizar emisor/proveedor/vendedor/comercio/razón social emisora.
- No usar como "establecimiento" el receptor/cliente salvo que no exista ningún emisor claro.
- No usar "Consumidor Final" como establecimiento.
- Si detectás nombre comercial y razón social del emisor, preferir nombre comercial si es claro.
- Si hay dudas entre más de un nombre, devolver opciones en "establecimiento_candidatos".`;

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
              esPdf
                ? { type: 'input_file', filename: archivo.name || 'comprobante.pdf', file_data: dataUrl }
                : { type: 'input_image', image_url: dataUrl },
            ],
          },
        ],
        text: { format: { type: 'json_object' } },
      }),
    });

    if (!respuestaOpenAI.ok) {
      const textoError = await respuestaOpenAI.text();
      throw Object.assign(new Error(esPdf ? 'No se pudo analizar el PDF con la configuración actual. Podés cargar el gasto manualmente.' : 'Error de OpenAI al analizar el comprobante.'), {
        status: respuestaOpenAI.status,
        response: { data: textoError },
      });
    }

    const data = (await respuestaOpenAI.json()) as RespuestaOpenAI;
    const contenido = extraerTextoOpenAI(data);

    if (!contenido) {
      const resumenRespuesta = resumirRespuestaOpenAI(data);
      if (process.env.NODE_ENV !== 'production') {
        console.error('No se encontró texto interpretable en la respuesta de OpenAI:', resumenRespuesta);
        return NextResponse.json({
          error: MENSAJE_ERROR_ANALISIS,
          detalle: 'OpenAI no devolvió texto interpretable.',
          fase: 'openai',
          respuesta_openai_resumida: resumenRespuesta,
        }, { status: 502 });
      }

      const detalle = extraerDetalleError('OpenAI no devolvió texto interpretable.');
      console.error('Error analizando comprobante:', detalle);
      return NextResponse.json(construirRespuestaError(detalle, 'validacion'), { status: 502 });
    }

    const contenidoLimpio = limpiarJsonDeMarkdown(contenido);

    let parsed: unknown;
    try {
      parsed = JSON.parse(contenidoLimpio) as unknown;
    } catch (error) {
      const detalle = extraerDetalleError(error);
      console.error('Error analizando comprobante:', {
        ...detalle,
        respuesta_cruda: contenido,
      });
      return NextResponse.json({
        error: MENSAJE_ERROR_ANALISIS,
        detalle: detalle.mensaje,
        fase: 'parseo_json',
        texto_recibido: process.env.NODE_ENV === 'production' ? undefined : contenido,
      }, { status: 502 });
    }


    const sugerencias = limpiarRespuesta(parsed);
    const textoAnalizado = [
      sugerencias.establecimiento,
      sugerencias.descripcion,
      sugerencias.observaciones,
      ...(sugerencias.advertencias ?? []),
    ].join(' ').toLowerCase();
    const indicadoresResumen = [
      'resumen de cuenta', 'resumen de tarjeta', 'pago minimo', 'pago mínimo', 'saldo anterior', 'cierre actual',
      'proximo vencimiento', 'próximo vencimiento', 'mastercard', 'visa', 'total a pagar', 'cuotas del resumen',
      'limite de compra', 'límite de compra', 'limite de financiacion', 'límite de financiación',
    ];
    const pareceResumenTarjeta = esPdf && indicadoresResumen.some((item) => textoAnalizado.includes(item));

    if (pareceResumenTarjeta) {
      return NextResponse.json({
        sugerencias: {
          ...sugerencias,
          advertencias: [
            ...sugerencias.advertencias,
            'Este PDF parece un resumen de tarjeta. La conciliación de resúmenes se implementará en una fase posterior.',
          ],
        },
        advertencias: ['Este PDF parece un resumen de tarjeta. La conciliación de resúmenes se implementará en una fase posterior.'],
        tipo_documento_detectado: 'resumen_tarjeta',
      });
    }

    return NextResponse.json({ sugerencias });

  } catch (error) {
    const detalle = extraerDetalleError(error);
    console.error('Error analizando comprobante:', {
      message: detalle.mensaje,
      name: detalle.name,
      status: detalle.status,
      code: detalle.code,
      type: detalle.type,
      stack: detalle.stack,
      data: detalle.data,
      raw: error,
    });

    return NextResponse.json(
      construirRespuestaError(detalle, 'validacion'),
      { status: 502 },
    );
  }
}
