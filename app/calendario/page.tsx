'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';
import { ErrorTecnicoDesarrollo } from '@/components/error-tecnico-desarrollo';
import { registrarErrorSpendWise, type ErrorTecnico } from '@/lib/errores';
import { consolidarDuplicadosCalendario, obtenerOCrearCalendarioEstimado } from '@/lib/calendario-tarjetas';

type CuentaTarjeta = {
  id: string;
  nombre_cuenta: string;
  banco: string | null;
  marca: string | null;
  dia_cierre_habitual: number | null;
  dias_hasta_vencimiento: number | null;
  activo: boolean;
};

type EstadoCalendario = 'estimado' | 'confirmado' | 'importado' | 'modificado_manual';
type EstadoCalendarioVisible = 'estimado' | 'confirmado';
type OrigenFecha = 'manual' | 'calculado' | 'importado' | 'resumen_banco';

type CalendarioTarjeta = {
  id: string;
  cuenta_tarjeta_id: string;
  periodo_resumen: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  estado_calendario: EstadoCalendario;
  origen_fecha: OrigenFecha;
  observaciones: string | null;
  creado_en: string;
  actualizado_en: string;
};

type GastoTarjeta = {
  id: string;
  cuenta_tarjeta_id: string | null;
  fecha_gasto: string;
  estado_registro: string;
};

type CuotaTarjeta = {
  id: string;
  gasto_id: string | null;
  estado: string;
};

type FormularioCalendario = {
  cuenta_tarjeta_id: string;
  periodo_resumen: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  estado_calendario: EstadoCalendario;
  observaciones: string;
};

type FormularioGeneracion = {
  mes_inicial: string;
  cantidad_meses: string;
};

const ESTADOS_VISIBLES: EstadoCalendarioVisible[] = ['estimado', 'confirmado'];

const estadoInicialFormulario: FormularioCalendario = {
  cuenta_tarjeta_id: '',
  periodo_resumen: '',
  fecha_cierre: '',
  fecha_vencimiento: '',
  estado_calendario: 'estimado',
  observaciones: '',
};

const estadoInicialGeneracion: FormularioGeneracion = {
  mes_inicial: '',
  cantidad_meses: '6',
};

function formatoPeriodoValido(periodo: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
}

function descripcionCuenta(cuenta: CuentaTarjeta) {
  const bancoMarca = [cuenta.banco, cuenta.marca].filter(Boolean).join(' · ');
  return bancoMarca ? `${cuenta.nombre_cuenta} (${bancoMarca})` : cuenta.nombre_cuenta;
}

function generarPeriodo(anio: number, mesIndex: number) {
  const mes = (mesIndex + 1).toString().padStart(2, '0');
  return `${anio}-${mes}`;
}

function sumarMeses(anio: number, mesIndex: number, meses: number) {
  const fecha = new Date(Date.UTC(anio, mesIndex + meses, 1));
  return { anio: fecha.getUTCFullYear(), mesIndex: fecha.getUTCMonth() };
}

function colorBadgeEstado(estado: EstadoCalendario) {
  if (estado === 'confirmado') return 'bg-emerald-100 text-emerald-700';
  if (estado === 'importado') return 'bg-sky-100 text-sky-700';
  if (estado === 'modificado_manual') return 'bg-amber-100 text-amber-700';
  return 'bg-slate-200 text-slate-700';
}

function estadoLegible(estado: EstadoCalendario) {
  if (estado === 'modificado_manual') return 'confirmado';
  return estado;
}

function estadoParaFormulario(estado: EstadoCalendario): EstadoCalendarioVisible {
  if (estado === 'importado') return 'confirmado';
  if (estado === 'modificado_manual') return 'confirmado';
  return estado;
}

function origenLegible(origen: OrigenFecha) {
  if (origen === 'resumen_banco') return 'resumen banco';
  if (origen === 'importado') return 'resumen banco';
  return origen;
}

export default function Page() {
  const [perfilCargando, setPerfilCargando] = useState(true);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [calendarios, setCalendarios] = useState<CalendarioTarjeta[]>([]);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [calendarioEditandoId, setCalendarioEditandoId] = useState<string | null>(null);
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState('');
  const [formulario, setFormulario] = useState<FormularioCalendario>(estadoInicialFormulario);
  const [formGeneracion, setFormGeneracion] = useState<FormularioGeneracion>(estadoInicialGeneracion);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [errorGeneracion, setErrorGeneracion] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [periodosConCuotas, setPeriodosConCuotas] = useState<Set<string>>(new Set());
  const [gastosTarjeta, setGastosTarjeta] = useState<GastoTarjeta[]>([]);
  const [cuotasTarjeta, setCuotasTarjeta] = useState<CuotaTarjeta[]>([]);
  const [errorTecnico, setErrorTecnico] = useState<ErrorTecnico | null>(null);

  const tituloFormulario = useMemo(
    () => (calendarioEditandoId ? 'Editar período de calendario' : 'Nuevo período de calendario'),
    [calendarioEditandoId],
  );

  const calendariosCuenta = useMemo(
    () => calendarios.filter((item) => item.cuenta_tarjeta_id === cuentaSeleccionadaId),
    [calendarios, cuentaSeleccionadaId],
  );
  const hayDuplicadosVisibles = useMemo(() => calendariosCuenta.some((item) => esDuplicado(item)), [calendariosCuenta, calendarios]);

  async function cargarDatos(grupoIdActivo: string) {
    setCargando(true);
    setMensaje(null);
    setErrorTecnico(null);

    try {

    const [
      { data: dataCuentas, error: errorCuentas },
      { data: dataCalendarios, error: errorCalendarios },
      { data: dataCuotas, error: errorCuotas },
      { data: dataGastos, error: errorGastos },
      { data: dataCuotasPorGasto, error: errorCuotasPorGasto },
    ] =
      await Promise.all([
        supabase
          .from('cuentas_tarjeta')
          .select('id, nombre_cuenta, banco, marca, dia_cierre_habitual, dias_hasta_vencimiento, activo')
          .eq('grupo_id', grupoIdActivo)
          .order('nombre_cuenta', { ascending: true }),
        supabase
          .from('calendario_tarjetas')
          .select(
            'id, cuenta_tarjeta_id, periodo_resumen, fecha_cierre, fecha_vencimiento, estado_calendario, origen_fecha, observaciones, creado_en, actualizado_en',
          )
          .eq('grupo_id', grupoIdActivo)
          .order('periodo_resumen', { ascending: false }),
        supabase.from('cuotas_tarjeta').select('cuenta_tarjeta_id, periodo_pago_estimado').eq('grupo_id', grupoIdActivo).neq('estado', 'cancelada'),
        supabase.from('gastos').select('id,cuenta_tarjeta_id,fecha_gasto,estado_registro').eq('grupo_id', grupoIdActivo).not('cuenta_tarjeta_id', 'is', null).neq('estado_registro', 'anulado'),
        supabase.from('cuotas_tarjeta').select('id,gasto_id,estado').eq('grupo_id', grupoIdActivo).neq('estado', 'cancelada'),
      ]);

    if (errorCuentas || errorCalendarios || errorCuotas || errorGastos || errorCuotasPorGasto) {
      const primerError = errorCuentas ?? errorCalendarios ?? errorCuotas ?? errorGastos ?? errorCuotasPorGasto;
      const detalle = registrarErrorSpendWise('calendario', primerError);
      setErrorTecnico(detalle);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar el calendario de tarjetas.' });
      return;
    }

    const cuentasCargadas = (dataCuentas ?? []) as CuentaTarjeta[];
    const calendariosCargados = (dataCalendarios ?? []) as CalendarioTarjeta[];
    const cuotas = (dataCuotas ?? []) as Array<{ cuenta_tarjeta_id: string; periodo_pago_estimado: string }>;
    const clavesConCuotas = new Set(
      cuotas
        .filter((item) => item.cuenta_tarjeta_id && item.periodo_pago_estimado)
        .map((item) => `${item.cuenta_tarjeta_id}::${item.periodo_pago_estimado}`),
    );

    setCuentas(cuentasCargadas);
    setCalendarios(calendariosCargados);
    setPeriodosConCuotas(clavesConCuotas);
    setGastosTarjeta((dataGastos ?? []) as GastoTarjeta[]);
    setCuotasTarjeta((dataCuotasPorGasto ?? []) as CuotaTarjeta[]);

    setCuentaSeleccionadaId((actual) => {
      if (actual && cuentasCargadas.some((c) => c.id === actual)) return actual;
      return cuentasCargadas[0]?.id ?? '';
    });

    setFormulario((actual) => {
      if (actual.cuenta_tarjeta_id) return actual;
      return { ...actual, cuenta_tarjeta_id: cuentasCargadas[0]?.id ?? '' };
    });

    } catch (errorCarga) {
      const detalle = registrarErrorSpendWise('calendario', errorCarga);
      setErrorTecnico(detalle);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar el calendario de tarjetas.' });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    let cancelado = false;

    async function cargarPerfil() {
      setPerfilCargando(true);
      setErrorTecnico(null);

      try {
        const perfil = await obtenerPerfilActivo();
        if (cancelado) return;
        setGrupoId(perfil.grupo_id);
        setUsuarioEmail(perfil.email);
      } catch (errorPerfil) {
        if (cancelado) return;
        const detalle = registrarErrorSpendWise('calendario', errorPerfil);
        setGrupoId(null);
        setErrorTecnico(detalle);
        setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });
      } finally {
        if (!cancelado) setPerfilCargando(false);
      }
    }

    void cargarPerfil();

    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (perfilCargando) return;

    if (!grupoId) {
      setCargando(false);
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });
      return;
    }

    void cargarDatos(grupoId);
  }, [perfilCargando, grupoId]);

  useEffect(() => {
    if (!grupoId || !cuentaSeleccionadaId) return;
    void resolverDuplicadosCuenta(cuentaSeleccionadaId, false);
  }, [cuentaSeleccionadaId]);

  function limpiarFormulario() {
    setCalendarioEditandoId(null);
    setErrorFormulario('');
    setFormulario((actual) => ({
      ...estadoInicialFormulario,
      cuenta_tarjeta_id: cuentaSeleccionadaId || actual.cuenta_tarjeta_id,
    }));
  }

  function editarCalendario(item: CalendarioTarjeta) {
    setCalendarioEditandoId(item.id);
    setCuentaSeleccionadaId(item.cuenta_tarjeta_id);
    setFormulario({
      cuenta_tarjeta_id: item.cuenta_tarjeta_id,
      periodo_resumen: item.periodo_resumen,
      fecha_cierre: item.fecha_cierre,
      fecha_vencimiento: item.fecha_vencimiento,
      estado_calendario: estadoParaFormulario(item.estado_calendario),
      observaciones: item.observaciones ?? '',
    });
    setErrorFormulario('');
    setMensaje(null);
  }

  function validarFormulario() {
    if (!formulario.cuenta_tarjeta_id) return 'La cuenta de tarjeta es obligatoria.';
    if (!formulario.periodo_resumen.trim()) return 'El período de resumen es obligatorio.';
    if (!formatoPeriodoValido(formulario.periodo_resumen.trim())) return 'El período debe tener formato YYYY-MM.';
    if (!formulario.fecha_cierre) return 'La fecha de cierre es obligatoria.';
    if (!formulario.fecha_vencimiento) return 'La fecha de vencimiento es obligatoria.';
    if (new Date(formulario.fecha_vencimiento) < new Date(formulario.fecha_cierre)) {
      return 'La fecha de vencimiento debe ser posterior o igual a la fecha de cierre.';
    }
    return '';
  }

  async function guardarCalendario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorFormulario('');
    setMensaje(null);

    if (!grupoId) return setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });

    const error = validarFormulario();
    if (error) return setErrorFormulario(error);

    const periodoNormalizado = formulario.periodo_resumen.trim();
    const yaExiste = calendarios.some(
      (item) =>
        item.cuenta_tarjeta_id === formulario.cuenta_tarjeta_id &&
        item.periodo_resumen === periodoNormalizado &&
        item.id !== calendarioEditandoId,
    );
    const cambioClave = calendarioEditandoId
      ? (() => {
          const original = calendarios.find((item) => item.id === calendarioEditandoId);
          if (!original) return true;
          return original.cuenta_tarjeta_id !== formulario.cuenta_tarjeta_id || original.periodo_resumen !== periodoNormalizado;
        })()
      : true;
    if (yaExiste && cambioClave) {
      return setErrorFormulario(
        calendarioEditandoId
          ? 'Ya existe otro calendario para esta cuenta y período.'
          : 'Ya existe un calendario para esta cuenta y período.',
      );
    }

    setGuardando(true);
    const payloadBase = {
      cuenta_tarjeta_id: formulario.cuenta_tarjeta_id,
      periodo_resumen: periodoNormalizado,
      fecha_cierre: formulario.fecha_cierre,
      fecha_vencimiento: formulario.fecha_vencimiento,
      estado_calendario: formulario.estado_calendario,
      observaciones: formulario.observaciones.trim() || null,
      actualizado_en: new Date().toISOString(),
    };
    const payload = calendarioEditandoId ? payloadBase : { ...payloadBase, origen_fecha: 'manual' as OrigenFecha };

    const respuesta = calendarioEditandoId
      ? await supabase.from('calendario_tarjetas').update(payload).eq('id', calendarioEditandoId).eq('grupo_id', grupoId)
      : await supabase.from('calendario_tarjetas').insert({ ...payload, grupo_id: grupoId });

    if (respuesta.error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar el período de calendario.' });
      setGuardando(false);
      return;
    }

    setMensaje({
      tipo: 'ok',
      texto: calendarioEditandoId ? 'Período actualizado correctamente.' : 'Período creado correctamente.',
    });
    setGuardando(false);
    limpiarFormulario();
    if (grupoId) await cargarDatos(grupoId);
  }

  async function generarMesesFuturos() {
    setErrorGeneracion('');
    setMensaje(null);

    if (!grupoId) return setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });
    if (!cuentaSeleccionadaId) return setErrorGeneracion('Primero seleccioná una cuenta de tarjeta.');
    if (!formGeneracion.mes_inicial || !formatoPeriodoValido(formGeneracion.mes_inicial)) {
      return setErrorGeneracion('El mes inicial debe tener formato YYYY-MM.');
    }

    const cantidad = Number.parseInt(formGeneracion.cantidad_meses, 10);
    if (Number.isNaN(cantidad) || cantidad < 1 || cantidad > 24) {
      return setErrorGeneracion('La cantidad de meses debe estar entre 1 y 24.');
    }

    const cuenta = cuentas.find((item) => item.id === cuentaSeleccionadaId);
    if (!cuenta) return setErrorGeneracion('No se encontró la cuenta seleccionada.');
    if (!cuenta.dia_cierre_habitual || cuenta.dia_cierre_habitual < 1 || cuenta.dia_cierre_habitual > 31) {
      return setErrorGeneracion('La cuenta no tiene un día de cierre habitual válido.');
    }

    const [anioInicial, mesInicial] = formGeneracion.mes_inicial.split('-').map(Number);
    const existentes = new Set(
      calendarios
        .filter((item) => item.cuenta_tarjeta_id === cuentaSeleccionadaId)
        .map((item) => item.periodo_resumen),
    );

    let generados = 0;
    let omitidos = 0;

    for (let i = 0; i < cantidad; i += 1) {
      const { anio, mesIndex } = sumarMeses(anioInicial, mesInicial - 1, i);
      const periodo = generarPeriodo(anio, mesIndex);
      if (existentes.has(periodo)) {
        omitidos += 1;
        continue;
      }

      const resultado = await obtenerOCrearCalendarioEstimado({ supabase, cuenta, periodo, contexto: 'calendario', grupoId });
      if (resultado.generado) generados += 1;
      else omitidos += 1;
    }

    setGenerando(true);
    setMensaje({
      tipo: 'ok',
      texto: `Se generaron ${generados} períodos. Se omitieron ${omitidos} períodos porque ya existían.`,
    });
    setGenerando(false);
    if (grupoId) await cargarDatos(grupoId);
  }

  function clavePeriodo(cuentaTarjetaId: string, periodoResumen: string) {
    return `${cuentaTarjetaId}::${periodoResumen}`;
  }

  function esDuplicado(item: CalendarioTarjeta) {
    return calendarios.some(
      (otro) =>
        otro.id !== item.id &&
        otro.cuenta_tarjeta_id === item.cuenta_tarjeta_id &&
        otro.periodo_resumen === item.periodo_resumen,
    );
  }

  function tieneCuotasAsociadas(item: CalendarioTarjeta) {
    return periodosConCuotas.has(clavePeriodo(item.cuenta_tarjeta_id, item.periodo_resumen));
  }

  function obtenerRangoCalendario(item: CalendarioTarjeta) {
    const calendariosCuentaOrdenados = calendarios
      .filter((cal) => cal.cuenta_tarjeta_id === item.cuenta_tarjeta_id)
      .sort((a, b) => a.fecha_cierre.localeCompare(b.fecha_cierre));
    const indice = calendariosCuentaOrdenados.findIndex((cal) => cal.id === item.id);
    const anterior = indice > 0 ? calendariosCuentaOrdenados[indice - 1] : null;
    const inicio = anterior ? new Date(`${anterior.fecha_cierre}T00:00:00Z`) : null;
    if (inicio) inicio.setUTCDate(inicio.getUTCDate() + 1);
    const fin = new Date(`${item.fecha_cierre}T00:00:00Z`);
    return { inicio, fin };
  }

  function gastoPerteneceACalendario(gasto: GastoTarjeta, calendario: CalendarioTarjeta) {
    if (gasto.cuenta_tarjeta_id !== calendario.cuenta_tarjeta_id) return false;
    const fechaGasto = new Date(`${gasto.fecha_gasto}T00:00:00Z`);
    const { inicio, fin } = obtenerRangoCalendario(calendario);
    if (inicio && fechaGasto < inicio) return false;
    return fechaGasto <= fin;
  }

  async function eliminarCalendario(item: CalendarioTarjeta) {
    setMensaje(null);
    if (!grupoId) return setMensaje({ tipo: 'error', texto: 'No se pudo cargar el grupo activo.' });

    const confirmacion = window.confirm('¿Querés eliminar este período de calendario?');
    if (!confirmacion) return;

    const esItemDuplicado = esDuplicado(item);
    const gastosAsociados = gastosTarjeta.filter((gasto) => gastoPerteneceACalendario(gasto, item));
    const idsGastosAsociados = new Set(gastosAsociados.map((gasto) => gasto.id));
    const cuotasDerivadas = cuotasTarjeta.filter((cuota) => cuota.gasto_id && idsGastosAsociados.has(cuota.gasto_id));

    if (gastosAsociados.length > 0) {
      setMensaje({
        tipo: 'error',
        texto:
          'No se puede eliminar este período porque tiene gastos de tarjeta asociados. Podés editar las fechas cuando tengas el cierre/vencimiento confirmado.',
      });
      return;
    }

    if ((tieneCuotasAsociadas(item) || cuotasDerivadas.length > 0) && !esItemDuplicado) {
      setMensaje({
        tipo: 'error',
        texto:
          'No se puede eliminar este período porque tiene pagos de tarjeta asociados. Podés editar las fechas cuando tengas el cierre/vencimiento confirmado.',
      });
      return;
    }
    if (esItemDuplicado) {
      const cantidadMismoPeriodo = calendarios.filter((otro) => otro.cuenta_tarjeta_id === item.cuenta_tarjeta_id && otro.periodo_resumen === item.periodo_resumen).length;
      if (cantidadMismoPeriodo <= 1 && tieneCuotasAsociadas(item)) {
        setMensaje({ tipo: 'error', texto: 'No se puede eliminar este período porque tiene pagos de tarjeta asociados.' });
        return;
      }
    }

    const { error } = await supabase.from('calendario_tarjetas').delete().eq('id', item.id).eq('grupo_id', grupoId);
    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo eliminar el período de calendario.' });
      return;
    }

    if (calendarioEditandoId === item.id) limpiarFormulario();
    setMensaje({ tipo: 'ok', texto: 'Período eliminado correctamente.' });
    if (grupoId) await cargarDatos(grupoId);
  }

  async function resolverDuplicadosCuenta(cuentaId: string, mostrarMensaje: boolean) {
    const grupos = new Map<string, CalendarioTarjeta[]>();
    calendarios.filter((item) => item.cuenta_tarjeta_id === cuentaId).forEach((item) => {
      const clave = `${item.cuenta_tarjeta_id}::${item.periodo_resumen}`;
      const lista = grupos.get(clave) ?? [];
      lista.push(item);
      grupos.set(clave, lista);
    });
    let eliminados = 0;
    let pendientes = 0;
    for (const duplicados of grupos.values()) {
      if (duplicados.length < 2) continue;
      const resultado = await consolidarDuplicadosCalendario(supabase, duplicados, grupoId);
      eliminados += resultado.eliminados;
      if (resultado.pendiente) pendientes += 1;
    }
    if (eliminados > 0 || pendientes > 0) if (grupoId) await cargarDatos(grupoId);
    if (mostrarMensaje && eliminados > 0) setMensaje({ tipo: 'ok', texto: 'Duplicados resueltos. Se conservó un calendario principal para cada período.' });
    if (!mostrarMensaje && eliminados > 0) setMensaje({ tipo: 'ok', texto: 'Se corrigieron períodos duplicados automáticamente.' });
  }

  return (
    <section className="mx-auto max-w-[1440px] space-y-5 px-2 pb-6 md:px-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SpendWise</p>
        <h1 className="text-2xl font-semibold">Calendario de cierres y vencimientos</h1>
        <p className="text-sm text-slate-600">
          El calendario por período es la fuente principal para proyectar en qué resumen entra cada gasto.
        </p>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800">
          <p className="font-semibold">¿Qué significan los estados?</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Estimado: fecha calculada por la app o cargada como proyección mientras todavía no se conoce el resumen real.</li>
            <li>Confirmado: fecha revisada por el usuario contra el resumen real del banco.</li>
          </ul>
          <p className="mt-2 font-semibold">Origen</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Manual: cargado por el usuario.</li>
            <li>Calculado: generado automáticamente por la app.</li>
            <li>Resumen banco: reservado para importaciones futuras.</li>
          </ul>
        </div>
      </header>

      {perfilCargando ? <p className="text-sm text-slate-500">Cargando grupo...</p> : null}
      <ErrorTecnicoDesarrollo error={errorTecnico} />

      {mensaje && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            mensaje.tipo === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {mensaje.texto}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{tituloFormulario}</h2>
            <p className="text-xs text-slate-500">Cargá o ajustá el período mensual de una cuenta de tarjeta.</p>
          </div>
          {calendarioEditandoId && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form onSubmit={guardarCalendario} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <label htmlFor="cuenta-tarjeta" className="mb-1 block text-xs font-medium text-slate-700">Cuenta de tarjeta</label>
            <select
              id="cuenta-tarjeta"
              value={formulario.cuenta_tarjeta_id}
              onChange={(e) => setFormulario((prev) => ({ ...prev, cuenta_tarjeta_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Seleccioná una cuenta *</option>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {descripcionCuenta(cuenta)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="periodo-resumen" className="mb-1 block text-xs font-medium text-slate-700">Período de resumen</label>
            <input
              id="periodo-resumen"
              value={formulario.periodo_resumen}
              onChange={(e) => setFormulario((prev) => ({ ...prev, periodo_resumen: e.target.value }))}
              placeholder="YYYY-MM"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Mes del resumen donde entran los gastos según la fecha de cierre. Ejemplo: 2026-05.</p>
          </div>
          <div>
            <label htmlFor="fecha-cierre" className="mb-1 block text-xs font-medium text-slate-700">Fecha de cierre</label>
            <input
              id="fecha-cierre"
              type="date"
              value={formulario.fecha_cierre}
              onChange={(e) => setFormulario((prev) => ({ ...prev, fecha_cierre: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Último día en que entran compras para este resumen.</p>
          </div>
          <div>
            <label htmlFor="fecha-vencimiento" className="mb-1 block text-xs font-medium text-slate-700">Fecha de vencimiento</label>
            <input
              id="fecha-vencimiento"
              type="date"
              value={formulario.fecha_vencimiento}
              onChange={(e) => setFormulario((prev) => ({ ...prev, fecha_vencimiento: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">Fecha estimada o confirmada en que se paga el resumen.</p>
          </div>
          <div>
            <label htmlFor="estado-calendario" className="mb-1 block text-xs font-medium text-slate-700">Estado</label>
            <select
              id="estado-calendario"
              value={formulario.estado_calendario}
              onChange={(e) => setFormulario((prev) => ({ ...prev, estado_calendario: e.target.value as EstadoCalendario }))}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {ESTADOS_VISIBLES.map((estado) => (
                <option key={estado} value={estado}>
                  {estadoLegible(estado)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Usá estimado mientras no tengas el resumen real. Cambialo a confirmado cuando revises las fechas del banco.</p>
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label htmlFor="observaciones" className="mb-1 block text-xs font-medium text-slate-700">Observaciones</label>
            <textarea
              id="observaciones"
              rows={1}
              value={formulario.observaciones}
              onChange={(e) => setFormulario((prev) => ({ ...prev, observaciones: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={guardando}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white md:col-span-2 xl:col-span-2"
          >
            {guardando ? 'Guardando...' : 'Guardar período'}
          </button>
        </form>

        {errorFormulario && <p className="mt-2 text-sm text-rose-600">{errorFormulario}</p>}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <h2 className="text-lg font-semibold">Crear períodos futuros (estimados)</h2>
        <p className="mb-3 text-xs text-slate-500">
          Usa el día de cierre habitual y días hasta vencimiento de la cuenta seleccionada. No duplica períodos existentes.
        </p>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            type="month"
            value={formGeneracion.mes_inicial}
            onChange={(e) => setFormGeneracion((prev) => ({ ...prev, mes_inicial: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            inputMode="numeric"
            value={formGeneracion.cantidad_meses}
            onChange={(e) => setFormGeneracion((prev) => ({ ...prev, cantidad_meses: e.target.value }))}
            placeholder="Cantidad de meses"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={generarMesesFuturos}
            disabled={generando || !cuentaSeleccionadaId}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white md:col-span-2"
          >
            {generando ? 'Generando...' : 'Generar meses'}
          </button>
        </div>
        {errorGeneracion && <p className="mt-2 text-sm text-rose-600">{errorGeneracion}</p>}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Calendario por cuenta</h2>
          {hayDuplicadosVisibles && (
            <button
              type="button"
              onClick={() => void resolverDuplicadosCuenta(cuentaSeleccionadaId, true)}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
            >
              Resolver duplicados
            </button>
          )}
        </div>

        {cargando ? (
          <p className="text-sm text-slate-600">Cargando calendario...</p>
        ) : cuentas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
            No hay cuentas de tarjeta registradas.
          </p>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {cuentas.map((cuenta) => (
                <button
                  type="button"
                  key={cuenta.id}
                  onClick={() => {
                    setCuentaSeleccionadaId(cuenta.id);
                    setFormulario((prev) => ({ ...prev, cuenta_tarjeta_id: cuenta.id }));
                  }}
                  className={`whitespace-nowrap rounded-xl border px-3 py-2 text-sm ${
                    cuenta.id === cuentaSeleccionadaId
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {cuenta.nombre_cuenta}
                </button>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Cierre</th>
                    <th className="px-3 py-2">Vencimiento</th>
                    <th className="px-3 py-2">Estado</th>
                    <th className="px-3 py-2">Origen</th>
                    <th className="px-3 py-2">Observaciones</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {calendariosCuenta.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-900">{item.periodo_resumen}</td>
                      <td className="px-3 py-2 text-slate-700">{item.fecha_cierre}</td>
                      <td className="px-3 py-2 text-slate-700">{item.fecha_vencimiento}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colorBadgeEstado(item.estado_calendario)}`}>
                          {estadoLegible(item.estado_calendario)}
                        </span>
                        {esDuplicado(item) && (
                          <span className="ml-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Duplicado</span>
                        )}
                        {tieneCuotasAsociadas(item) && (
                          <span className="ml-1 rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">Con cuotas</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{origenLegible(item.origen_fecha)}</td>
                      <td className="px-3 py-2 text-slate-700">{item.observaciones || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => editarCalendario(item)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarCalendario(item)}
                            className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs text-rose-700"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {calendariosCuenta.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900">{item.periodo_resumen}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${colorBadgeEstado(item.estado_calendario)}`}>
                      {estadoLegible(item.estado_calendario)}
                    </span>
                  </div>
                  <div className="mb-2 flex gap-1">
                    {esDuplicado(item) && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">Duplicado</span>
                    )}
                    {tieneCuotasAsociadas(item) && (
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">Con cuotas</span>
                    )}
                  </div>
                  <div className="space-y-1 text-xs text-slate-600">
                    <p><span className="font-medium text-slate-700">Cierre:</span> {item.fecha_cierre}</p>
                    <p><span className="font-medium text-slate-700">Vencimiento:</span> {item.fecha_vencimiento}</p>
                    <p><span className="font-medium text-slate-700">Origen:</span> {origenLegible(item.origen_fecha)}</p>
                    <p><span className="font-medium text-slate-700">Observaciones:</span> {item.observaciones || '-'}</p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => editarCalendario(item)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                    >
                      Editar período
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarCalendario(item)}
                      className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs text-rose-700"
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {calendariosCuenta.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                No hay períodos cargados para esta cuenta.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
