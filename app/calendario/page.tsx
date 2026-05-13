'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

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

type FormularioCalendario = {
  cuenta_tarjeta_id: string;
  periodo_resumen: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  estado_calendario: EstadoCalendario;
  origen_fecha: OrigenFecha;
  observaciones: string;
};

type FormularioGeneracion = {
  mes_inicial: string;
  cantidad_meses: string;
};

const ESTADOS: EstadoCalendario[] = ['estimado', 'confirmado', 'importado', 'modificado_manual'];
const ORIGENES: OrigenFecha[] = ['manual', 'calculado', 'importado', 'resumen_banco'];

const estadoInicialFormulario: FormularioCalendario = {
  cuenta_tarjeta_id: '',
  periodo_resumen: '',
  fecha_cierre: '',
  fecha_vencimiento: '',
  estado_calendario: 'estimado',
  origen_fecha: 'manual',
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

function obtenerUltimoDiaDelMes(anio: number, mesIndex: number) {
  return new Date(Date.UTC(anio, mesIndex + 1, 0)).getUTCDate();
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
  if (estado === 'modificado_manual') return 'modificado manual';
  return estado;
}

export default function Page() {
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [calendarios, setCalendarios] = useState<CalendarioTarjeta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [calendarioEditandoId, setCalendarioEditandoId] = useState<string | null>(null);
  const [cuentaSeleccionadaId, setCuentaSeleccionadaId] = useState('');
  const [formulario, setFormulario] = useState<FormularioCalendario>(estadoInicialFormulario);
  const [formGeneracion, setFormGeneracion] = useState<FormularioGeneracion>(estadoInicialGeneracion);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [errorGeneracion, setErrorGeneracion] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const tituloFormulario = useMemo(
    () => (calendarioEditandoId ? 'Editar período de calendario' : 'Nuevo período de calendario'),
    [calendarioEditandoId],
  );

  const calendariosCuenta = useMemo(
    () => calendarios.filter((item) => item.cuenta_tarjeta_id === cuentaSeleccionadaId),
    [calendarios, cuentaSeleccionadaId],
  );

  async function cargarDatos() {
    setCargando(true);
    setMensaje(null);

    const [{ data: dataCuentas, error: errorCuentas }, { data: dataCalendarios, error: errorCalendarios }] =
      await Promise.all([
        supabase
          .from('cuentas_tarjeta')
          .select('id, nombre_cuenta, banco, marca, dia_cierre_habitual, dias_hasta_vencimiento, activo')
          .order('nombre_cuenta', { ascending: true }),
        supabase
          .from('calendario_tarjetas')
          .select(
            'id, cuenta_tarjeta_id, periodo_resumen, fecha_cierre, fecha_vencimiento, estado_calendario, origen_fecha, observaciones, creado_en, actualizado_en',
          )
          .order('periodo_resumen', { ascending: false }),
      ]);

    if (errorCuentas || errorCalendarios) {
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar el calendario de tarjetas.' });
      setCargando(false);
      return;
    }

    const cuentasCargadas = (dataCuentas ?? []) as CuentaTarjeta[];
    const calendariosCargados = (dataCalendarios ?? []) as CalendarioTarjeta[];

    setCuentas(cuentasCargadas);
    setCalendarios(calendariosCargados);

    setCuentaSeleccionadaId((actual) => {
      if (actual && cuentasCargadas.some((c) => c.id === actual)) return actual;
      return cuentasCargadas[0]?.id ?? '';
    });

    setFormulario((actual) => {
      if (actual.cuenta_tarjeta_id) return actual;
      return { ...actual, cuenta_tarjeta_id: cuentasCargadas[0]?.id ?? '' };
    });

    setCargando(false);
  }

  useEffect(() => {
    void cargarDatos();
  }, []);

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
      estado_calendario: item.estado_calendario,
      origen_fecha: item.origen_fecha,
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

    const error = validarFormulario();
    if (error) return setErrorFormulario(error);

    const periodoNormalizado = formulario.periodo_resumen.trim();
    const yaExiste = calendarios.some(
      (item) =>
        item.cuenta_tarjeta_id === formulario.cuenta_tarjeta_id &&
        item.periodo_resumen === periodoNormalizado &&
        item.id !== calendarioEditandoId,
    );
    if (yaExiste) return setErrorFormulario('Ya existe ese período para la cuenta seleccionada.');

    setGuardando(true);
    const payload = {
      cuenta_tarjeta_id: formulario.cuenta_tarjeta_id,
      periodo_resumen: periodoNormalizado,
      fecha_cierre: formulario.fecha_cierre,
      fecha_vencimiento: formulario.fecha_vencimiento,
      estado_calendario: formulario.estado_calendario,
      origen_fecha: formulario.origen_fecha,
      observaciones: formulario.observaciones.trim() || null,
      actualizado_en: new Date().toISOString(),
    };

    const respuesta = calendarioEditandoId
      ? await supabase.from('calendario_tarjetas').update(payload).eq('id', calendarioEditandoId)
      : await supabase.from('calendario_tarjetas').insert(payload);

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
    await cargarDatos();
  }

  async function generarMesesFuturos() {
    setErrorGeneracion('');
    setMensaje(null);

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

    const diasVencimiento = cuenta.dias_hasta_vencimiento ?? 0;
    const [anioInicial, mesInicial] = formGeneracion.mes_inicial.split('-').map(Number);
    const existentes = new Set(
      calendarios
        .filter((item) => item.cuenta_tarjeta_id === cuentaSeleccionadaId)
        .map((item) => item.periodo_resumen),
    );

    const nuevosRegistros: Array<Omit<CalendarioTarjeta, 'id' | 'creado_en' | 'actualizado_en'>> = [];

    for (let i = 0; i < cantidad; i += 1) {
      const { anio, mesIndex } = sumarMeses(anioInicial, mesInicial - 1, i);
      const periodo = generarPeriodo(anio, mesIndex);
      if (existentes.has(periodo)) continue;

      const ultimoDia = obtenerUltimoDiaDelMes(anio, mesIndex);
      const diaCierre = Math.min(cuenta.dia_cierre_habitual, ultimoDia);
      const fechaCierre = new Date(Date.UTC(anio, mesIndex, diaCierre));
      const fechaVencimiento = new Date(fechaCierre);
      fechaVencimiento.setUTCDate(fechaVencimiento.getUTCDate() + diasVencimiento);

      nuevosRegistros.push({
        cuenta_tarjeta_id: cuentaSeleccionadaId,
        periodo_resumen: periodo,
        fecha_cierre: fechaCierre.toISOString().slice(0, 10),
        fecha_vencimiento: fechaVencimiento.toISOString().slice(0, 10),
        estado_calendario: 'estimado',
        origen_fecha: 'calculado',
        observaciones: null,
      });
    }

    if (nuevosRegistros.length === 0) {
      return setErrorGeneracion('No hay períodos nuevos para crear (ya existen todos).');
    }

    setGenerando(true);
    const { error } = await supabase.from('calendario_tarjetas').insert(nuevosRegistros);

    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudieron generar los períodos futuros.' });
      setGenerando(false);
      return;
    }

    setMensaje({ tipo: 'ok', texto: `Se generaron ${nuevosRegistros.length} períodos estimados.` });
    setGenerando(false);
    await cargarDatos();
  }

  return (
    <section className="mx-auto max-w-[1440px] space-y-5 px-2 pb-6 md:px-4">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SpendWise</p>
        <h1 className="text-2xl font-semibold">Calendario de cierres y vencimientos</h1>
        <p className="text-sm text-slate-600">
          El calendario por período es la fuente principal para proyectar en qué resumen entra cada gasto.
        </p>
      </header>

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

        <form onSubmit={guardarCalendario} className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
          <select
            value={formulario.cuenta_tarjeta_id}
            onChange={(e) => setFormulario((prev) => ({ ...prev, cuenta_tarjeta_id: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm xl:col-span-2"
          >
            <option value="">Cuenta de tarjeta *</option>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>
                {descripcionCuenta(cuenta)}
              </option>
            ))}
          </select>

          <input
            value={formulario.periodo_resumen}
            onChange={(e) => setFormulario((prev) => ({ ...prev, periodo_resumen: e.target.value }))}
            placeholder="Período (YYYY-MM) *"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={formulario.fecha_cierre}
            onChange={(e) => setFormulario((prev) => ({ ...prev, fecha_cierre: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={formulario.fecha_vencimiento}
            onChange={(e) => setFormulario((prev) => ({ ...prev, fecha_vencimiento: e.target.value }))}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={formulario.estado_calendario}
            onChange={(e) => setFormulario((prev) => ({ ...prev, estado_calendario: e.target.value as EstadoCalendario }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {estadoLegible(estado)}
              </option>
            ))}
          </select>
          <select
            value={formulario.origen_fecha}
            onChange={(e) => setFormulario((prev) => ({ ...prev, origen_fecha: e.target.value as OrigenFecha }))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {ORIGENES.map((origen) => (
              <option key={origen} value={origen}>
                {origen}
              </option>
            ))}
          </select>

          <textarea
            rows={1}
            value={formulario.observaciones}
            onChange={(e) => setFormulario((prev) => ({ ...prev, observaciones: e.target.value }))}
            placeholder="Observaciones"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2 xl:col-span-4"
          />
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
        <h2 className="text-lg font-semibold">Calendario por cuenta</h2>

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
                      </td>
                      <td className="px-3 py-2 text-slate-700">{item.origen_fecha}</td>
                      <td className="px-3 py-2 text-slate-700">{item.observaciones || '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => editarCalendario(item)}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700"
                        >
                          Editar
                        </button>
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
                  <div className="space-y-1 text-xs text-slate-600">
                    <p><span className="font-medium text-slate-700">Cierre:</span> {item.fecha_cierre}</p>
                    <p><span className="font-medium text-slate-700">Vencimiento:</span> {item.fecha_vencimiento}</p>
                    <p><span className="font-medium text-slate-700">Origen:</span> {item.origen_fecha}</p>
                    <p><span className="font-medium text-slate-700">Observaciones:</span> {item.observaciones || '-'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => editarCalendario(item)}
                    className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                  >
                    Editar período
                  </button>
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
