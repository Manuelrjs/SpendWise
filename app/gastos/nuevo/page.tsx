'use client';

import { ChangeEvent, ClipboardEvent, DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { MENSAJE_ERROR_BUCKET_COMPROBANTES, normalizarNombreArchivo, validarComprobante } from '@/lib/comprobantes';
import { DatosComprobanteSugeridos, extraerDatosComprobante } from '@/lib/ia/extraer-comprobante';
import {
  calcularPeriodoTarjeta,
  CalendarioTarjeta,
  construirFechaCierreEstimada,
  construirFechaVencimientoEstimada,
  formatearPeriodoDesdeFecha,
  sumarMesesPeriodo,
} from '@/utils/tarjetas';

type MedioPago = { id: string; nombre: string; tipo: string; activo: boolean; orden: number | null };
type Categoria = { id: string; nombre: string; icono: string | null; color: string | null; activo: boolean; orden: number | null };
type Persona = { id: string; nombre: string; apellido: string | null; activo: boolean };
type CuentaTarjeta = { id: string; nombre_cuenta: string; banco: string | null; marca: string | null; dia_cierre_habitual: number | null; dias_hasta_vencimiento: number | null; activo: boolean };
type TarjetaFisica = { id: string; cuenta_tarjeta_id: string; persona_id: string; alias: string | null; tipo: string; ultimos_4_digitos: string | null; activo: boolean };

type Formulario = {
  monto: string; moneda: string; medio_pago_id: string; cuenta_tarjeta_id: string; tarjeta_fisica_id: string; fecha_gasto: string;
  establecimiento: string; categoria_id: string; persona_id: string; cantidad_cuotas: number; descripcion: string; observaciones: string;
};

const HOY = new Date().toISOString().slice(0, 10);
const inicial: Formulario = { monto: '', moneda: 'ARS', medio_pago_id: '', cuenta_tarjeta_id: '', tarjeta_fisica_id: '', fecha_gasto: HOY, establecimiento: '', categoria_id: '', persona_id: '', cantidad_cuotas: 1, descripcion: '', observaciones: '' };


function formatearTamanoArchivo(tamano: number) {
  if (tamano < 1024 * 1024) return `${(tamano / 1024).toFixed(1)} KB`;
  return `${(tamano / (1024 * 1024)).toFixed(1)} MB`;
}

function crearNombreComprobantePegado() {
  const fecha = new Date();
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  const hh = String(fecha.getHours()).padStart(2, '0');
  const min = String(fecha.getMinutes()).padStart(2, '0');
  return `comprobante-pegado-${yyyy}-${mm}-${dd}-${hh}${min}.png`;
}

export default function Page() {
  const [formulario, setFormulario] = useState<Formulario>(inicial);
  const [medios, setMedios] = useState<MedioPago[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [calendarios, setCalendarios] = useState<CalendarioTarjeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [advertencia, setAdvertencia] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mostrarAvanzado, setMostrarAvanzado] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [mensajeComprobante, setMensajeComprobante] = useState<string | null>(null);
  const [arrastrandoComprobante, setArrastrandoComprobante] = useState(false);
  const [analizandoComprobante, setAnalizandoComprobante] = useState(false);
  const [sugerenciasIA, setSugerenciasIA] = useState<DatosComprobanteSugeridos | null>(null);
  const inputSubirRef = useRef<HTMLInputElement | null>(null);
  const inputCamaraRef = useRef<HTMLInputElement | null>(null);

  const medioSeleccionado = useMemo(() => medios.find((medio) => medio.id === formulario.medio_pago_id), [medios, formulario.medio_pago_id]);
  const esTarjetaCredito = medioSeleccionado?.tipo === 'tarjeta_credito';
  const tarjetasCuenta = useMemo(() => tarjetas.filter((t) => t.cuenta_tarjeta_id === formulario.cuenta_tarjeta_id), [tarjetas, formulario.cuenta_tarjeta_id]);

  useEffect(() => { void cargarDatos(); }, []);
  useEffect(() => {
    if (!esTarjetaCredito) {
      setFormulario((prev) => ({ ...prev, cuenta_tarjeta_id: '', tarjeta_fisica_id: '', cantidad_cuotas: 1 }));
    }
  }, [esTarjetaCredito]);

  async function cargarDatos() {
    const [m, c, p, ct, tf, cal] = await Promise.all([
      supabase.from('medios_pago').select('id,nombre,tipo,activo,orden').eq('activo', true).order('orden'),
      supabase.from('categorias').select('id,nombre,icono,color,activo,orden').eq('activo', true).order('orden'),
      supabase.from('personas').select('id,nombre,apellido,activo').eq('activo', true).order('nombre'),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta,banco,marca,dia_cierre_habitual,dias_hasta_vencimiento,activo').eq('activo', true).order('nombre_cuenta'),
      supabase.from('tarjetas_fisicas').select('id,cuenta_tarjeta_id,persona_id,alias,tipo,ultimos_4_digitos,activo').eq('activo', true),
      supabase.from('calendario_tarjetas').select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones'),
    ]);
    if ([m,c,p,ct,tf,cal].some((r) => r.error)) return setError('No se pudieron cargar los datos iniciales.');
    setMedios(m.data ?? []); setCategorias(c.data ?? []); setPersonas(p.data ?? []); setCuentas(ct.data ?? []); setTarjetas(tf.data ?? []); setCalendarios((cal.data ?? []) as CalendarioTarjeta[]);
  }

  async function asegurarCalendario(cuenta: CuentaTarjeta, periodo: string) {
    const existente = calendarios.find((cal) => cal.cuenta_tarjeta_id === cuenta.id && cal.periodo_resumen === periodo);
    if (existente) return { calendario: existente, generado: false };
    if (!cuenta.dia_cierre_habitual || cuenta.dias_hasta_vencimiento === null) throw new Error('Esta cuenta no tiene configuración habitual de cierre/vencimiento. Completala en Tarjetas o cargá el calendario manualmente.');
    const fecha_cierre = construirFechaCierreEstimada(periodo, cuenta.dia_cierre_habitual);
    const fecha_vencimiento = construirFechaVencimientoEstimada(fecha_cierre, cuenta.dias_hasta_vencimiento);
    const payload = { cuenta_tarjeta_id: cuenta.id, periodo_resumen: periodo, fecha_cierre, fecha_vencimiento, estado_calendario: 'estimado', origen_fecha: 'calculado', observaciones: 'Calendario generado automáticamente al registrar un gasto.' };
    const { data, error: err } = await supabase.from('calendario_tarjetas').insert(payload).select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones').single();
    if (err) throw new Error('No se pudo generar el calendario estimado automáticamente.');
    const nuevo = data as CalendarioTarjeta;
    setCalendarios((prev) => [...prev, nuevo]);
    return { calendario: nuevo, generado: true };
  }


  function seleccionarComprobante(archivo: File | null) {
    if (!archivo) return;
    const validacion = validarComprobante(archivo);
    if (!validacion.valido) return setError(validacion.mensaje);
    setComprobante(archivo);
    setSugerenciasIA(null);
    setMensajeComprobante(null);
    setError(null);
  }

  async function analizarComprobante() {
    if (!comprobante) return setMensajeComprobante('Primero adjuntá un comprobante para analizar.');
    setAnalizandoComprobante(true);
    setMensajeComprobante(null);
    setError(null);
    try {
      const sugerencias = await extraerDatosComprobante({
        file: comprobante,
        categorias: categorias.map((categoria) => ({ id: categoria.id, nombre: categoria.nombre })),
        mediosPago: medios.map((medio) => ({ id: medio.id, nombre: medio.nombre, tipo: medio.tipo })),
      });
      setSugerenciasIA(sugerencias);
    } catch (error) {
      console.error(error);
      setError('No se pudo analizar el comprobante. Podés cargar el gasto manualmente.');
    } finally {
      setAnalizandoComprobante(false);
    }
  }

  function aplicarSugerenciasIA() {
    if (!sugerenciasIA) return;
    setFormulario((prev) => ({
      ...prev,
      monto: sugerenciasIA.monto !== undefined ? String(sugerenciasIA.monto) : prev.monto,
      moneda: sugerenciasIA.moneda ?? prev.moneda,
      fecha_gasto: sugerenciasIA.fecha_gasto ?? prev.fecha_gasto,
      establecimiento: sugerenciasIA.establecimiento ?? prev.establecimiento,
      categoria_id: sugerenciasIA.categoria_id ?? prev.categoria_id,
      medio_pago_id: sugerenciasIA.medio_pago_id ?? prev.medio_pago_id,
      descripcion: sugerenciasIA.descripcion ?? prev.descripcion,
      observaciones: sugerenciasIA.observaciones ?? prev.observaciones,
    }));
    setMensajeComprobante('Sugerencias aplicadas. Revisá los datos antes de guardar.');
  }

  async function crearCategoriaDesdeSugerencia() {
    const nombreSugerido = sugerenciasIA?.categoria_no_aplicada?.trim();
    if (!nombreSugerido) return;
    const ordenMaximo = categorias.reduce((maximo, categoria) => Math.max(maximo, categoria.orden ?? 0), 0);
    const { data, error: errorInsert } = await supabase
      .from('categorias')
      .insert({ nombre: nombreSugerido, activo: true, orden: ordenMaximo + 1, icono: null, color: null })
      .select('id,nombre,icono,color,activo,orden')
      .single();
    if (errorInsert || !data) {
      setError('No se pudo crear la categoría sugerida. Probá nuevamente.');
      return;
    }
    const nuevaCategoria = data as Categoria;
    setCategorias((prev) => [...prev, nuevaCategoria]);
    setFormulario((prev) => ({ ...prev, categoria_id: nuevaCategoria.id }));
    setSugerenciasIA((prev) => (prev ? { ...prev, categoria_id: nuevaCategoria.id, categoria_no_aplicada: undefined } : prev));
    setMensajeComprobante(`Se creó la categoría "${nuevaCategoria.nombre}" y quedó seleccionada.`);
  }

  function manejarCambioArchivo(event: ChangeEvent<HTMLInputElement>) {
    seleccionarComprobante(event.target.files?.[0] ?? null);
    event.currentTarget.value = '';
  }

  function manejarPegadoComprobante(event: ClipboardEvent<HTMLDivElement>) {
    const item = Array.from(event.clipboardData.items).find((clipboardItem) => clipboardItem.type.startsWith('image/'));
    if (!item) return setMensajeComprobante('No se detectó una imagen en el portapapeles.');
    event.preventDefault();
    const blob = item.getAsFile();
    if (!blob) return setMensajeComprobante('No se detectó una imagen en el portapapeles.');
    const archivoPegado = new File([blob], crearNombreComprobantePegado(), { type: 'image/png' });
    seleccionarComprobante(archivoPegado);
  }

  async function pegarComprobanteDesdeBoton() {
    if (!navigator.clipboard?.read) {
      setMensajeComprobante('Tu navegador no permite pegar desde botón. Usá Ctrl+V / ⌘V dentro de la zona.');
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const itemConImagen = clipboardItems.find((item) => item.types.some((tipo) => tipo.startsWith('image/')));
      if (!itemConImagen) {
        setMensajeComprobante('No se detectó una imagen en el portapapeles.');
        return;
      }
      const tipoImagen = itemConImagen.types.find((tipo) => tipo.startsWith('image/')) ?? 'image/png';
      const blob = await itemConImagen.getType(tipoImagen);
      const archivoPegado = new File([blob], crearNombreComprobantePegado(), { type: tipoImagen });
      seleccionarComprobante(archivoPegado);
    } catch {
      setMensajeComprobante('No se pudo leer el portapapeles. Permití acceso o usá Ctrl+V / ⌘V.');
    }
  }

  function manejarDropComprobante(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setArrastrandoComprobante(false);
    seleccionarComprobante(event.dataTransfer.files?.[0] ?? null);
  }

  async function guardar(event: FormEvent) {
    event.preventDefault(); setError(null); setMensaje(null); setAdvertencia(null);
    const monto = Number(formulario.monto);
    if (!(monto > 0)) return setError('El monto debe ser mayor a 0.');
    if (!formulario.establecimiento.trim()) return setError('El establecimiento es obligatorio.');
    if (!formulario.fecha_gasto) return setError('La fecha es obligatoria.');
    if (!formulario.medio_pago_id) return setError('Seleccioná un medio de pago.');
    if (!formulario.categoria_id) return setError('Seleccioná una categoría.');
    if (!formulario.persona_id) return setError('Seleccioná una persona.');
    if (esTarjetaCredito && (!formulario.cuenta_tarjeta_id || !formulario.tarjeta_fisica_id || formulario.cantidad_cuotas < 1)) return setError('Para tarjeta de crédito completá cuenta, tarjeta física y cuotas válidas.');
    if (comprobante) {
      const validacionComprobante = validarComprobante(comprobante);
      if (!validacionComprobante.valido) return setError(validacionComprobante.mensaje);
    }
    setGuardando(true);
    try {
      const payload = { ...formulario, monto, establecimiento: formulario.establecimiento.trim(), cuenta_tarjeta_id: esTarjetaCredito ? formulario.cuenta_tarjeta_id : null, tarjeta_fisica_id: esTarjetaCredito ? formulario.tarjeta_fisica_id : null, cantidad_cuotas: esTarjetaCredito ? formulario.cantidad_cuotas : 1 };
      const { data: gasto, error: eg } = await supabase.from('gastos').insert(payload).select('id').single();
      if (eg || !gasto) throw new Error('No se pudo guardar el gasto.');

      if (comprobante) {
        const fechaComprobante = formulario.fecha_gasto ? new Date(`${formulario.fecha_gasto}T00:00:00`) : new Date();
        const anio = String(fechaComprobante.getFullYear());
        const mes = String(fechaComprobante.getMonth() + 1).padStart(2, '0');
        const nombreArchivo = normalizarNombreArchivo(comprobante.name);
        const rutaStorage = `${anio}/${mes}/${gasto.id}/${nombreArchivo}`;

        const { error: errorStorage } = await supabase.storage.from('comprobantes').upload(rutaStorage, comprobante, { upsert: false, contentType: comprobante.type });
        if (errorStorage) {
          console.error(errorStorage);
          throw new Error(MENSAJE_ERROR_BUCKET_COMPROBANTES);
        }

        const { data: urlFirmada, error: errorUrl } = await supabase.storage.from('comprobantes').createSignedUrl(rutaStorage, 60 * 60 * 24 * 7);
        if (errorUrl) {
          console.error(errorUrl);
        }

        const { error: errorComprobante } = await supabase.from('comprobantes').insert({
          gasto_id: gasto.id,
          tipo_comprobante: comprobante.type === 'application/pdf' ? 'factura_pdf' : 'ticket_imagen',
          tipo_archivo: comprobante.type,
          nombre_archivo: comprobante.name,
          ruta_storage: rutaStorage,
          url_storage: urlFirmada?.signedUrl ?? null,
          proveedor_almacenamiento: 'supabase',
          estado_archivo: 'activo',
          tamano_bytes: comprobante.size,
        });
        if (errorComprobante) {
          console.error(errorComprobante);
          throw new Error('Se guardó el gasto pero no se pudo asociar el comprobante.');
        }
      }

      if (esTarjetaCredito) {
        const cuenta = cuentas.find((c) => c.id === formulario.cuenta_tarjeta_id);
        if (!cuenta) throw new Error('No se encontró la cuenta de tarjeta seleccionada.');

        let periodo = formatearPeriodoDesdeFecha(formulario.fecha_gasto);
        let usaronEstimados = false;
        const calendarioBase = await asegurarCalendario(cuenta, periodo);
        usaronEstimados ||= calendarioBase.generado || calendarioBase.calendario.estado_calendario === 'estimado';
        let resultado = calcularPeriodoTarjeta({ fecha_gasto: formulario.fecha_gasto, cuenta_tarjeta_id: cuenta.id, calendarios: [...calendarios, calendarioBase.calendario] });

        const cuotasPayload = [];
        for (let i = 0; i < formulario.cantidad_cuotas; i += 1) {
          const periodoResumenCuota = i === 0 ? resultado.periodo_resumen : sumarMesesPeriodo(resultado.periodo_resumen, i);
          const calCuota = await asegurarCalendario(cuenta, periodoResumenCuota);
          usaronEstimados ||= calCuota.generado || calCuota.calendario.estado_calendario === 'estimado';
          const periodoPago = i === 0 ? resultado.periodo_pago : sumarMesesPeriodo(resultado.periodo_pago, i);
          cuotasPayload.push({
            gasto_id: gasto.id,
            cuenta_tarjeta_id: cuenta.id,
            tarjeta_fisica_id: formulario.tarjeta_fisica_id,
            persona_id: formulario.persona_id,
            establecimiento: formulario.establecimiento.trim(),
            descripcion_cuota: formulario.descripcion.trim() || formulario.establecimiento.trim(),
            numero_cuota: i + 1,
            total_cuotas: formulario.cantidad_cuotas,
            monto_cuota: monto / formulario.cantidad_cuotas,
            moneda: formulario.moneda,
            periodo_pago_estimado: periodoPago,
            fecha_estimada_pago: calCuota.calendario.fecha_vencimiento,
            estado: 'pendiente',
            origen_cuota: 'gasto_nuevo',
          });
        }
        const { error: ec } = await supabase.from('cuotas_tarjeta').insert(cuotasPayload);
        if (ec) throw new Error('Se guardó el gasto, pero falló la generación de cuotas.');
        if (usaronEstimados) setAdvertencia('Se usaron fechas estimadas de cierre/vencimiento. Podés confirmarlas luego desde Calendario.');
      }

      setMensaje('Gasto registrado con éxito.');
      setFormulario({ ...inicial, fecha_gasto: HOY });
      setComprobante(null);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'Ocurrió un error al guardar el gasto.');
    } finally { setGuardando(false); }
  }

  return <section className="mx-auto max-w-4xl space-y-4"><h1 className="text-2xl font-semibold">Nuevo gasto</h1>{error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>}{mensaje && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{mensaje}</p>}{advertencia && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">{advertencia}</p>}<form onSubmit={guardar} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div><label className="text-sm font-medium">Monto *</label><input value={formulario.monto} onChange={(e) => setFormulario((p) => ({ ...p, monto: e.target.value }))} inputMode="decimal" className="mt-1 w-full rounded-xl border px-4 py-3 text-2xl font-semibold" placeholder="0,00" /></div><div className="grid grid-cols-2 gap-2"><input value={formulario.moneda} onChange={(e) => setFormulario((p) => ({ ...p, moneda: e.target.value }))} className="rounded-xl border px-3 py-2" /><input type="date" value={formulario.fecha_gasto} onChange={(e) => setFormulario((p) => ({ ...p, fecha_gasto: e.target.value }))} className="rounded-xl border px-3 py-2" /></div><div><p className="mb-2 text-sm font-medium">Medio de pago *</p><div className="grid grid-cols-2 gap-2">{medios.map((medio) => <button key={medio.id} type="button" onClick={() => setFormulario((p) => ({ ...p, medio_pago_id: medio.id }))} className={`rounded-xl border px-3 py-2 text-sm ${formulario.medio_pago_id === medio.id ? 'border-emerald-500 bg-emerald-50' : ''}`}>{medio.nombre}</button>)}</div></div>
<div><label className="text-sm font-medium">Establecimiento *</label><input value={formulario.establecimiento} onChange={(e) => setFormulario((p) => ({ ...p, establecimiento: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></div>
<div id="seccion-categorias"><p className="mb-2 text-sm font-medium">Categoría *</p><div className="grid grid-cols-2 gap-2">{categorias.map((cat) => <button key={cat.id} type="button" onClick={() => setFormulario((p) => ({ ...p, categoria_id: cat.id }))} className={`rounded-xl border px-3 py-2 text-sm ${formulario.categoria_id === cat.id ? 'border-emerald-500 bg-emerald-50' : ''}`}>{cat.icono ? `${cat.icono} ` : ''}{cat.nombre}</button>)}</div></div>
{esTarjetaCredito && <><div><p className="mb-2 text-sm font-medium">Cuenta de tarjeta *</p><div className="space-y-2">{cuentas.map((cuenta) => <button key={cuenta.id} type="button" onClick={() => setFormulario((p) => ({ ...p, cuenta_tarjeta_id: cuenta.id, tarjeta_fisica_id: '' }))} className={`w-full rounded-xl border p-3 text-left ${formulario.cuenta_tarjeta_id === cuenta.id ? 'border-emerald-500 bg-emerald-50' : ''}`}><p className="font-medium">{cuenta.nombre_cuenta}</p><p className="text-xs text-slate-500">{cuenta.banco ?? ''} {cuenta.marca ?? ''}</p></button>)}</div></div>
<div><p className="mb-2 text-sm font-medium">Tarjeta física *</p><div className="space-y-2">{tarjetasCuenta.map((tarjeta) => <button key={tarjeta.id} type="button" onClick={() => setFormulario((p) => ({ ...p, tarjeta_fisica_id: tarjeta.id, persona_id: tarjeta.persona_id }))} className={`w-full rounded-xl border p-3 text-left ${formulario.tarjeta_fisica_id === tarjeta.id ? 'border-emerald-500 bg-emerald-50' : ''}`}>{tarjeta.alias ?? tarjeta.tipo} {tarjeta.ultimos_4_digitos ? `• ${tarjeta.ultimos_4_digitos}` : ''}</button>)}</div></div>
<div><label className="text-sm font-medium">Cantidad de cuotas *</label><input type="number" min={1} value={formulario.cantidad_cuotas} onChange={(e) => setFormulario((p) => ({ ...p, cantidad_cuotas: Number(e.target.value) || 1 }))} className="mt-1 w-full rounded-xl border px-3 py-2" /></div></>}
<div className="rounded-xl border border-slate-200 p-3"><p className="text-sm font-medium">Comprobante</p><p className="text-xs text-slate-600">Opcional: adjuntá una foto, imagen o PDF del ticket/factura.</p><p className="mt-1 text-xs text-slate-500">También podés pegar una imagen copiada desde WhatsApp.</p><div tabIndex={0} onPaste={manejarPegadoComprobante} onDragOver={(event) => { event.preventDefault(); setArrastrandoComprobante(true); }} onDragLeave={() => setArrastrandoComprobante(false)} onDrop={manejarDropComprobante} className={`mt-2 rounded-xl border border-dashed p-3 ${arrastrandoComprobante ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}><p className="text-xs text-slate-600">Arrastrá una imagen/PDF acá o pegá una imagen copiada.</p><div className="mt-3 grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => inputCamaraRef.current?.click()} className="rounded-xl border bg-white px-3 py-2 text-xs font-medium">Tomar foto del comprobante</button><button type="button" onClick={() => inputSubirRef.current?.click()} className="rounded-xl border bg-white px-3 py-2 text-xs font-medium">Subir imagen o PDF</button><button type="button" onClick={() => void pegarComprobanteDesdeBoton()} className="rounded-xl border bg-white px-3 py-2 text-xs font-medium">Pegar imagen copiada</button></div><input ref={inputCamaraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={manejarCambioArchivo} /><input ref={inputSubirRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={manejarCambioArchivo} /></div>{mensajeComprobante ? <p className="mt-2 text-xs text-slate-500">{mensajeComprobante}</p> : null}{comprobante ? <div className="mt-2 space-y-2 text-xs"><p className="truncate"><span className="font-medium">Archivo:</span> {comprobante.name}</p><p><span className="font-medium">Tipo:</span> {comprobante.type || 'Sin tipo'}</p><p><span className="font-medium">Tamaño:</span> {formatearTamanoArchivo(comprobante.size)}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void analizarComprobante()} disabled={analizandoComprobante} className="rounded border border-emerald-600 px-2 py-1 text-emerald-700 disabled:opacity-60">{analizandoComprobante ? 'Analizando comprobante...' : 'Analizar comprobante'}</button><button type="button" onClick={() => { setComprobante(null); setSugerenciasIA(null); }} className="rounded border px-2 py-1">Quitar comprobante</button></div></div> : <p className="mt-2 text-xs text-slate-500">Sin comprobante seleccionado.</p>}{sugerenciasIA ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><p className="font-semibold text-sm">Datos sugeridos por IA</p><p className="mt-1 text-amber-700">Revisá los datos antes de guardar. La lectura automática puede tener errores.</p><ul className="mt-2 space-y-1 text-slate-700"><li><span className="font-medium">Datos leídos - Fecha:</span> {sugerenciasIA.fecha_gasto ?? 'Sin sugerencia'}</li><li><span className="font-medium">Datos leídos - Establecimiento:</span> {sugerenciasIA.establecimiento ?? 'Sin sugerencia'}</li><li><span className="font-medium">Datos leídos - Monto:</span> {sugerenciasIA.monto ?? 'Sin sugerencia'}</li><li><span className="font-medium">Datos leídos - Moneda:</span> {sugerenciasIA.moneda ?? 'Sin sugerencia'}</li><li><span className="font-medium">Categoría sugerida por IA:</span> {sugerenciasIA.categoria_sugerida ?? 'Sin sugerencia'}</li><li><span className="font-medium">Categoría aplicada:</span> {sugerenciasIA.categoria_id ? (categorias.find((cat) => cat.id === sugerenciasIA.categoria_id)?.nombre ?? 'Sin coincidencia') : 'No aplicada'}</li><li><span className="font-medium">Medio de pago sugerido por IA:</span> {sugerenciasIA.medio_pago_sugerido ?? 'Sin sugerencia'}</li><li><span className="font-medium">Medio de pago aplicado:</span> {sugerenciasIA.medio_pago_id ? (medios.find((medio) => medio.id === sugerenciasIA.medio_pago_id)?.nombre ?? 'Sin coincidencia') : 'No aplicado'}</li><li><span className="font-medium">Confianza:</span> {sugerenciasIA.confianza ? `${Math.round(sugerenciasIA.confianza * 100)}%` : 'Sin dato'}</li><li><span className="font-medium">CUIT/RUC/NIT:</span> {sugerenciasIA.identificador_fiscal ?? 'Sin sugerencia'}</li><li><span className="font-medium">Observaciones:</span> {sugerenciasIA.observaciones ?? 'Sin observaciones'}</li></ul>{sugerenciasIA.categoria_mapeo_detalle ? <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{sugerenciasIA.categoria_mapeo_detalle}</p> : null}{sugerenciasIA.medio_pago_mapeo_detalle ? <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{sugerenciasIA.medio_pago_mapeo_detalle}</p> : null}{sugerenciasIA.categoria_no_aplicada ? <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-amber-700"><p>La IA sugirió una categoría que no existe: {sugerenciasIA.categoria_no_aplicada}.</p><p>Elegí una categoría existente o creá una nueva.</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => document.getElementById('seccion-categorias')?.scrollIntoView({ behavior: 'smooth' })} className="rounded border border-amber-500 bg-white px-2 py-1">Usar categoría existente</button><button type="button" onClick={() => void crearCategoriaDesdeSugerencia()} className="rounded border border-emerald-600 bg-emerald-50 px-2 py-1 text-emerald-700">Crear categoría {sugerenciasIA.categoria_no_aplicada}</button><button type="button" onClick={() => setSugerenciasIA((prev) => (prev ? { ...prev, categoria_no_aplicada: undefined } : prev))} className="rounded border bg-white px-2 py-1">Ignorar sugerencia</button></div></div> : null}{sugerenciasIA.medio_pago_no_aplicado ? <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">La IA sugirió un medio de pago sin coincidencia clara: {sugerenciasIA.medio_pago_no_aplicado}. Elegí uno manualmente.</p> : null}{sugerenciasIA.advertencias?.length ? <ul className="mt-2 list-disc pl-5 text-amber-700">{sugerenciasIA.advertencias.map((advertenciaItem) => <li key={advertenciaItem}>{advertenciaItem}</li>)}</ul> : null}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={aplicarSugerenciasIA} className="rounded border border-emerald-600 bg-emerald-50 px-2 py-1 text-emerald-700">Aplicar sugerencias</button><button type="button" onClick={() => setSugerenciasIA(null)} className="rounded border px-2 py-1">Descartar sugerencias</button></div></div> : null}</div>
<div><label className="text-sm font-medium">Persona *</label><select value={formulario.persona_id} onChange={(e) => setFormulario((p) => ({ ...p, persona_id: e.target.value }))} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Seleccionar persona</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{persona.nombre} {persona.apellido ?? ''}</option>)}</select></div>
<button type="button" onClick={() => setMostrarAvanzado((v) => !v)} className="text-sm text-slate-600">{mostrarAvanzado ? 'Ocultar campos avanzados' : 'Mostrar campos avanzados'}</button>
{mostrarAvanzado && <div className="grid gap-2"><input value={formulario.descripcion} onChange={(e) => setFormulario((p) => ({ ...p, descripcion: e.target.value }))} className="rounded-xl border px-3 py-2" placeholder="Descripción" /><textarea value={formulario.observaciones} onChange={(e) => setFormulario((p) => ({ ...p, observaciones: e.target.value }))} className="rounded-xl border px-3 py-2" placeholder="Observaciones" /></div>}
<div className="rounded-xl bg-slate-50 p-3 text-sm"><p className="font-medium">Resumen</p><p>{formulario.establecimiento || 'Sin establecimiento'} · {formulario.moneda} {formulario.monto || '0'} · {esTarjetaCredito ? `${formulario.cantidad_cuotas} cuota(s)` : 'Pago único'}</p></div>
<button disabled={guardando} className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">{guardando ? 'Guardando...' : 'Guardar gasto'}</button></form></section>;
}
