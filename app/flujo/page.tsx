'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';

type CuentaTarjeta = {
  id: string;
  nombre_cuenta: string;
  activo: boolean;
};

type Persona = { id: string; nombre: string; apellido: string | null };
type TarjetaFisica = { id: string; alias: string | null; tipo: string; ultimos_4_digitos: string | null };

type CuotaTarjeta = {
  id: string;
  gasto_id: string | null;
  compra_cuota_inicial_id: string | null;
  cuenta_tarjeta_id: string;
  tarjeta_fisica_id: string | null;
  persona_id: string | null;
  establecimiento: string;
  descripcion_cuota: string | null;
  numero_cuota: number;
  total_cuotas: number;
  monto_cuota: number;
  moneda: string;
  periodo_pago_estimado: string;
  estado: string;
  origen_cuota: string;
  observaciones: string | null;
};

type GrupoCompra = {
  clave: string;
  cuentaTarjetaId: string;
  establecimiento: string;
  descripcion: string;
  tarjetaFisicaId: string | null;
  personaId: string | null;
  origen: string;
  moneda: string;
  cuotas: CuotaTarjeta[];
  cuotasPendientes: string;
  montoCuotaReferencia: number;
  totalPendienteVisible: number;
  montosPorPeriodo: Map<string, number>;
};

type Filtros = {
  mesInicial: string;
  cantidadMeses: 3 | 6 | 12;
  cuentaTarjetaId: string;
  personaId: string;
  origenCuota: string;
  medioPagoId: string;
};

type MedioPago = { id: string; nombre: string; tipo: string; activo: boolean };

type GastoDirecto = {
  id: string;
  fecha_gasto: string;
  monto: number;
  moneda: string;
  establecimiento: string;
  descripcion: string | null;
  observaciones: string | null;
  persona_id: string | null;
  medio_pago_id: string | null;
  categoria: { nombre: string } | null;
  persona: { nombre: string; apellido: string | null } | null;
  medio_pago: { nombre: string; tipo: string } | null;
  estado_registro: string;
};

const ESTADOS_INCLUIDOS = ['pendiente', 'proyectada', 'incluida_resumen', 'no_incluida', 'reprogramada'];
const ESTADOS_EXCLUIDOS = ['cancelada', 'pagada'];

const BADGE_ESTADO: Record<string, string> = {
  pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  proyectada: 'bg-sky-50 text-sky-700 border-sky-200',
  reprogramada: 'bg-violet-50 text-violet-700 border-violet-200',
  pagada: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelada: 'bg-rose-50 text-rose-700 border-rose-200',
};

const BADGE_ORIGEN: Record<string, string> = {
  gasto_nuevo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  carga_inicial: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  importacion: 'bg-sky-50 text-sky-700 border-sky-200',
  ajuste_manual: 'bg-amber-50 text-amber-700 border-amber-200',
  conciliacion: 'bg-violet-50 text-violet-700 border-violet-200',
};

function sumarMeses(periodo: string, cantidad: number) {
  const [anioRaw, mesRaw] = periodo.split('-');
  const anio = Number(anioRaw);
  const mes = Number(mesRaw);
  const base = new Date(Date.UTC(anio, mes - 1 + cantidad, 1));
  const nuevoAnio = base.getUTCFullYear();
  const nuevoMes = String(base.getUTCMonth() + 1).padStart(2, '0');
  return `${nuevoAnio}-${nuevoMes}`;
}

function obtenerPeriodoActual() {
  const hoy = new Date();
  return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
}

function obtenerPeriodoDesdeFecha(fecha: string) {
  const valor = fecha.slice(0, 10);
  const [anio, mes] = valor.split('-');
  if (!anio || !mes) return '';
  return `${anio}-${mes}`;
}


function obtenerClaveGrupo(cuota: CuotaTarjeta) {
  if (cuota.gasto_id) return `gasto:${cuota.gasto_id}`;
  if (cuota.compra_cuota_inicial_id) return `inicial:${cuota.compra_cuota_inicial_id}`;
  const establecimiento = cuota.establecimiento.trim().toLowerCase();
  const descripcion = (cuota.descripcion_cuota ?? '').trim().toLowerCase();
  return `fallback:${cuota.cuenta_tarjeta_id}:${establecimiento}:${descripcion}`;
}

function obtenerRangoCuotas(cuotas: CuotaTarjeta[]) {
  const ordenadas = [...cuotas].sort((a, b) => a.numero_cuota - b.numero_cuota);
  if (ordenadas.length === 0) return 'Sin cuotas';
  const primera = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  if (primera.total_cuotas === 1 && ultima.total_cuotas === 1) return 'Pago único';
  if (primera.numero_cuota === ultima.numero_cuota) return `${primera.numero_cuota}/${primera.total_cuotas}`;
  return `${primera.numero_cuota}/${primera.total_cuotas} a ${ultima.numero_cuota}/${ultima.total_cuotas}`;
}

function formatearMonto(monto: number, moneda: string) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}

export default function FlujoPage() {
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [cuotas, setCuotas] = useState<CuotaTarjeta[]>([]);
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [gastosDirectos, setGastosDirectos] = useState<GastoDirecto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [celdaActiva, setCeldaActiva] = useState<{ tipo: 'tarjeta' | 'gasto_directo'; clave: string; periodo: string } | null>(null);
  const [mostrarDesglose, setMostrarDesglose] = useState(false);
  const [filasExpandidas, setFilasExpandidas] = useState<Record<string, boolean>>({});

  const [filtros, setFiltros] = useState<Filtros>({
    mesInicial: obtenerPeriodoActual(),
    cantidadMeses: 6,
    cuentaTarjetaId: '',
    personaId: '',
    origenCuota: '',
    medioPagoId: '',
  });

  useEffect(() => {
    void cargarDatos();
  }, []);

  async function cargarDatos() {
    if (!grupoId) return;
    setCargando(true);
    setError(null);

    const [cuentasRes, personasRes, tarjetasRes, cuotasRes, mediosPagoRes, gastosRes] = await Promise.all([
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta,activo').eq('activo', true).order('nombre_cuenta'),
      supabase.from('personas').select('id,nombre,apellido').eq('grupo_id', grupoId).order('nombre'),
      supabase.from('tarjetas_fisicas').select('id,alias,tipo,ultimos_4_digitos').order('alias'),
      supabase
        .from('cuotas_tarjeta')
        .select('id,gasto_id,compra_cuota_inicial_id,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,establecimiento,descripcion_cuota,numero_cuota,total_cuotas,monto_cuota,moneda,periodo_pago_estimado,estado,origen_cuota,observaciones')
        .not('estado', 'in', '(cancelada)'),
      supabase.from('medios_pago').select('id,nombre,tipo,activo').eq('activo', true).eq('grupo_id', grupoId).order('nombre'),
      supabase
        .from('gastos')
        .select('id,fecha_gasto,monto,moneda,establecimiento,descripcion,observaciones,persona_id,medio_pago_id,estado_registro,categoria:categorias(nombre),persona:personas(nombre,apellido),medio_pago:medios_pago(nombre,tipo)')
        .neq('estado_registro', 'anulado'),
    ]);

    if (cuentasRes.error || personasRes.error || tarjetasRes.error || cuotasRes.error || mediosPagoRes.error || gastosRes.error) {
      const primerError = cuentasRes.error ?? personasRes.error ?? tarjetasRes.error ?? cuotasRes.error ?? mediosPagoRes.error ?? gastosRes.error;
      console.error(primerError);
      setError('No se pudo cargar el flujo mensual. Revisá la conexión con Supabase.');
      setCargando(false);
      return;
    }

    setCuentas((cuentasRes.data ?? []) as CuentaTarjeta[]);
    setPersonas((personasRes.data ?? []) as Persona[]);
    setTarjetas((tarjetasRes.data ?? []) as TarjetaFisica[]);
    setCuotas((cuotasRes.data ?? []) as CuotaTarjeta[]);
    setMediosPago((mediosPagoRes.data ?? []) as MedioPago[]);
    setGastosDirectos((gastosRes.data ?? []) as GastoDirecto[]);
    setCargando(false);
  }

  const periodos = useMemo(
    () => Array.from({ length: filtros.cantidadMeses }, (_, idx) => sumarMeses(filtros.mesInicial, idx)),
    [filtros.cantidadMeses, filtros.mesInicial],
  );

  const nombresPersonas = useMemo(
    () => new Map(personas.map((p) => [p.id, `${p.nombre} ${p.apellido ?? ''}`.trim()])),
    [personas],
  );
  const nombresTarjetas = useMemo(
    () => new Map(tarjetas.map((t) => [t.id, `${t.alias ?? t.tipo}${t.ultimos_4_digitos ? ` • ${t.ultimos_4_digitos}` : ''}`])),
    [tarjetas],
  );
  const nombresMediosPago = useMemo(() => new Map(mediosPago.map((medio) => [medio.id, medio.nombre])), [mediosPago]);

  const cuotasFiltradas = useMemo(
    () =>
      cuotas.filter((cuota) => {
        if (!periodos.includes(cuota.periodo_pago_estimado)) return false;
        if (filtros.cuentaTarjetaId && cuota.cuenta_tarjeta_id !== filtros.cuentaTarjetaId) return false;
        if (filtros.personaId && cuota.persona_id !== filtros.personaId) return false;
        if (filtros.origenCuota && cuota.origen_cuota !== filtros.origenCuota) return false;
        return true;
      }),
    [cuotas, filtros, periodos],
  );

  const cuotasParaSuma = useMemo(
    () => cuotasFiltradas.filter((cuota) => ESTADOS_INCLUIDOS.includes(cuota.estado) && !ESTADOS_EXCLUIDOS.includes(cuota.estado)),
    [cuotasFiltradas],
  );
  const gastosDirectosFiltrados = useMemo(
    () =>
      gastosDirectos.filter((gasto) => {
        const tipoMedio = gasto.medio_pago?.tipo ?? '';
        if (tipoMedio === 'tarjeta_credito') return false;
        const periodo = obtenerPeriodoDesdeFecha(gasto.fecha_gasto);
        if (!periodos.includes(periodo)) return false;
        if (filtros.personaId && gasto.persona_id !== filtros.personaId) return false;
        if (filtros.medioPagoId && gasto.medio_pago_id !== filtros.medioPagoId) return false;
        return true;
      }),
    [gastosDirectos, filtros.medioPagoId, filtros.personaId, periodos],
  );

  const matrizGastosDirectos = useMemo(() => {
    const base = new Map<string, Map<string, number>>();
    for (const medio of mediosPago) {
      if (medio.tipo === 'tarjeta_credito') continue;
      base.set(medio.id, new Map(periodos.map((periodo) => [periodo, 0])));
    }
    for (const gasto of gastosDirectosFiltrados) {
      if (!gasto.medio_pago_id || !base.has(gasto.medio_pago_id)) continue;
      const periodo = obtenerPeriodoDesdeFecha(gasto.fecha_gasto);
      const fila = base.get(gasto.medio_pago_id)!;
      fila.set(periodo, (fila.get(periodo) ?? 0) + gasto.monto);
    }
    return base;
  }, [gastosDirectosFiltrados, mediosPago, periodos]);

  const matriz = useMemo(() => {
    const base = new Map<string, Map<string, number>>();
    for (const cuenta of cuentas) {
      base.set(cuenta.id, new Map(periodos.map((periodo) => [periodo, 0])));
    }
    for (const cuota of cuotasParaSuma) {
      if (!base.has(cuota.cuenta_tarjeta_id)) continue;
      const fila = base.get(cuota.cuenta_tarjeta_id)!;
      const montoPrevio = fila.get(cuota.periodo_pago_estimado) ?? 0;
      fila.set(cuota.periodo_pago_estimado, montoPrevio + cuota.monto_cuota);
    }
    return base;
  }, [cuentas, cuotasParaSuma, periodos]);

  const cuentasVisibles = useMemo(() => {
    return cuentas.filter((cuenta) => {
      if (filtros.cuentaTarjetaId && cuenta.id !== filtros.cuentaTarjetaId) return false;
      return periodos.some((periodo) => (matriz.get(cuenta.id)?.get(periodo) ?? 0) > 0);
    });
  }, [cuentas, filtros.cuentaTarjetaId, matriz, periodos]);
  const mediosPagoVisibles = useMemo(
    () =>
      mediosPago.filter((medio) => {
        if (medio.tipo === 'tarjeta_credito') return false;
        if (filtros.medioPagoId && medio.id !== filtros.medioPagoId) return false;
        return periodos.some((periodo) => (matrizGastosDirectos.get(medio.id)?.get(periodo) ?? 0) > 0);
      }),
    [filtros.medioPagoId, matrizGastosDirectos, mediosPago, periodos],
  );

  const totalesTarjetaPorMes = useMemo(() => {
    const totales = new Map<string, number>();
    for (const periodo of periodos) {
      totales.set(
        periodo,
        cuentasVisibles.reduce((acc, cuenta) => acc + (matriz.get(cuenta.id)?.get(periodo) ?? 0), 0),
      );
    }
    return totales;
  }, [cuentasVisibles, matriz, periodos]);

  const totalesGastosDirectosPorMes = useMemo(() => {
    const totales = new Map<string, number>();
    for (const periodo of periodos) {
      totales.set(
        periodo,
        mediosPagoVisibles.reduce((acc, medio) => acc + (matrizGastosDirectos.get(medio.id)?.get(periodo) ?? 0), 0),
      );
    }
    return totales;
  }, [matrizGastosDirectos, mediosPagoVisibles, periodos]);

  const totalesPorMes = useMemo(() => {
    const totales = new Map<string, number>();
    for (const periodo of periodos) {
      const totalTarjetas = totalesTarjetaPorMes.get(periodo) ?? 0;
      const totalDirectos = totalesGastosDirectosPorMes.get(periodo) ?? 0;
      totales.set(periodo, totalTarjetas + totalDirectos);
    }
    return totales;
  }, [periodos, totalesGastosDirectosPorMes, totalesTarjetaPorMes]);

  const totalGeneralVisible = useMemo(
    () => periodos.reduce((acc, periodo) => acc + (totalesPorMes.get(periodo) ?? 0), 0),
    [periodos, totalesPorMes],
  );

  const totalMesActual = totalesPorMes.get(periodos[0]) ?? 0;
  const totalProximoMes = totalesPorMes.get(periodos[1]) ?? 0;
  const totalTarjetasMesActual = totalesTarjetaPorMes.get(periodos[0]) ?? 0;
  const totalDirectosMesActual = totalesGastosDirectosPorMes.get(periodos[0]) ?? 0;
  const cuotasPendientesVisibles = cuotasParaSuma.length;

  const cuentaActiva = useMemo(() => {
    if (!celdaActiva || celdaActiva.tipo !== 'tarjeta') return null;
    return cuentas.find((cuenta) => cuenta.id === celdaActiva.clave) ?? null;
  }, [celdaActiva, cuentas]);

  const detalleCelda = useMemo(() => {
    if (!celdaActiva) return [];
    if (celdaActiva.tipo !== 'tarjeta') return [];
    return cuotasFiltradas.filter((cuota) => cuota.cuenta_tarjeta_id === celdaActiva.clave && cuota.periodo_pago_estimado === celdaActiva.periodo);
  }, [celdaActiva, cuotasFiltradas]);
  const detalleDirectoCelda = useMemo(() => {
    if (!celdaActiva || celdaActiva.tipo !== 'gasto_directo') return [];
    return gastosDirectosFiltrados.filter(
      (gasto) => gasto.medio_pago_id === celdaActiva.clave && obtenerPeriodoDesdeFecha(gasto.fecha_gasto) === celdaActiva.periodo,
    );
  }, [celdaActiva, gastosDirectosFiltrados]);

  const desglosePorCuenta = useMemo(() => {
    const porCuenta = new Map<string, GrupoCompra[]>();

    for (const cuenta of cuentasVisibles) {
      porCuenta.set(cuenta.id, []);
    }

    const grupos = new Map<string, GrupoCompra>();

    for (const cuota of cuotasParaSuma) {
      if (!periodos.includes(cuota.periodo_pago_estimado)) continue;
      if (!porCuenta.has(cuota.cuenta_tarjeta_id)) continue;

      const claveBase = obtenerClaveGrupo(cuota);
      const clave = `${cuota.cuenta_tarjeta_id}__${claveBase}`;
      const actual = grupos.get(clave);

      if (!actual) {
        grupos.set(clave, {
          clave,
          cuentaTarjetaId: cuota.cuenta_tarjeta_id,
          establecimiento: cuota.establecimiento,
          descripcion: cuota.descripcion_cuota ?? 'Sin descripción',
          tarjetaFisicaId: cuota.tarjeta_fisica_id,
          personaId: cuota.persona_id,
          origen: cuota.origen_cuota,
          moneda: cuota.moneda,
          cuotas: [cuota],
          cuotasPendientes: '',
          montoCuotaReferencia: cuota.monto_cuota,
          totalPendienteVisible: cuota.monto_cuota,
          montosPorPeriodo: new Map(periodos.map((periodo) => [periodo, periodo === cuota.periodo_pago_estimado ? cuota.monto_cuota : 0])),
        });
        continue;
      }

      actual.cuotas.push(cuota);
      actual.totalPendienteVisible += cuota.monto_cuota;
      const previo = actual.montosPorPeriodo.get(cuota.periodo_pago_estimado) ?? 0;
      actual.montosPorPeriodo.set(cuota.periodo_pago_estimado, previo + cuota.monto_cuota);
    }

    for (const grupo of grupos.values()) {
      grupo.cuotasPendientes = obtenerRangoCuotas(grupo.cuotas);
      grupo.cuotas.sort((a, b) => (a.periodo_pago_estimado === b.periodo_pago_estimado ? a.numero_cuota - b.numero_cuota : a.periodo_pago_estimado.localeCompare(b.periodo_pago_estimado)));
      porCuenta.get(grupo.cuentaTarjetaId)?.push(grupo);
    }

    for (const [cuentaId, gruposCuenta] of porCuenta.entries()) {
      gruposCuenta.sort((a, b) => a.establecimiento.localeCompare(b.establecimiento));
      porCuenta.set(cuentaId, gruposCuenta);
    }

    return porCuenta;
  }, [cuotasParaSuma, cuentasVisibles, periodos]);

  const manejarClickCelda = (tipo: 'tarjeta' | 'gasto_directo', clave: string, periodo: string, monto: number) => {
    if (monto <= 0) return;
    setCeldaActiva((actual) => {
      if (actual?.tipo === tipo && actual.clave === clave && actual.periodo === periodo) {
        return null;
      }
      return { tipo, clave, periodo };
    });
  };

  const alternarFila = (clave: string) => {
    setFilasExpandidas((actual) => ({ ...actual, [clave]: !actual[clave] }));
  };

  const expandirTodo = () => {
    const siguiente: Record<string, boolean> = {};
    for (const medio of mediosPagoVisibles) siguiente[`medio:${medio.id}`] = true;
    for (const cuenta of cuentasVisibles) siguiente[`cuenta:${cuenta.id}`] = true;
    setFilasExpandidas(siguiente);
  };

  const contraerTodo = () => {
    setFilasExpandidas({});
  };

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Flujo mensual de pagos</h1>
        <p className="text-sm text-slate-600">Proyección de salidas mensuales por gastos directos y pagos de tarjeta.</p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <CardTitulo titulo="Total salida este mes" valor={formatearMonto(totalMesActual, 'ARS')} destacado />
        <CardTitulo titulo="Tarjetas a reservar este mes" valor={formatearMonto(totalTarjetasMesActual, 'ARS')} />
        <CardTitulo titulo="Gastos directos este mes" valor={formatearMonto(totalDirectosMesActual, 'ARS')} />
        <CardTitulo titulo="Comprometido próximo mes" valor={formatearMonto(totalProximoMes, 'ARS')} />
        <CardTitulo titulo="Cuotas pendientes visibles" valor={String(cuotasPendientesVisibles)} />
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-2xl border bg-white p-3 md:grid-cols-6">
        <input type="month" value={filtros.mesInicial} onChange={(e) => setFiltros((p) => ({ ...p, mesInicial: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm" />
        <select value={filtros.cantidadMeses} onChange={(e) => setFiltros((p) => ({ ...p, cantidadMeses: Number(e.target.value) as 3 | 6 | 12 }))} className="rounded-xl border px-3 py-2 text-sm">
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
        </select>
        <select value={filtros.cuentaTarjetaId} onChange={(e) => setFiltros((p) => ({ ...p, cuentaTarjetaId: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">Todas las cuentas</option>
          {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre_cuenta}</option>)}
        </select>
        <select value={filtros.personaId} onChange={(e) => setFiltros((p) => ({ ...p, personaId: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">Todas las personas</option>
          {personas.map((persona) => <option key={persona.id} value={persona.id}>{`${persona.nombre} ${persona.apellido ?? ''}`.trim()}</option>)}
        </select>
        <select value={filtros.origenCuota} onChange={(e) => setFiltros((p) => ({ ...p, origenCuota: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">Todos los orígenes</option>
          <option value="gasto_nuevo">gasto_nuevo</option><option value="carga_inicial">carga_inicial</option><option value="importacion">importacion</option><option value="ajuste_manual">ajuste_manual</option><option value="conciliacion">conciliacion</option>
        </select>
        <select value={filtros.medioPagoId} onChange={(e) => setFiltros((p) => ({ ...p, medioPagoId: e.target.value }))} className="rounded-xl border px-3 py-2 text-sm">
          <option value="">Todos los medios de pago</option>
          {mediosPago.filter((medio) => medio.tipo !== 'tarjeta_credito').map((medio) => <option key={medio.id} value={medio.id}>{medio.nombre}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={mostrarDesglose}
          onChange={(e) => setMostrarDesglose(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
        />
        Mostrar desglose de cuotas
      </label>
      {mostrarDesglose && (
        <div className="flex gap-2">
          <button onClick={expandirTodo} className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Expandir todo</button>
          <button onClick={contraerTodo} className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">Contraer todo</button>
        </div>
      )}

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {cargando && <p className="rounded-xl border bg-white px-3 py-2 text-sm">Cargando flujo mensual...</p>}

      {!cargando && !error && cuentasVisibles.length === 0 && mediosPagoVisibles.length === 0 && (
        <p className="rounded-xl border bg-white px-3 py-3 text-sm">Todavía no hay salidas proyectadas para este período.</p>
      )}

      {!cargando && !error && (cuentasVisibles.length > 0 || mediosPagoVisibles.length > 0) && (
        <>
          <div className="hidden overflow-x-auto rounded-2xl border bg-white md:block">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className="min-w-[320px] px-3 py-2 font-semibold">Cuenta / Compra</th>
                  <th className="px-3 py-2 font-semibold">Cuotas</th>
                  <th className="px-3 py-2 text-right font-semibold">Monto cuota</th>
                  <th className="px-3 py-2 text-right font-semibold">Pendiente visible</th>
                  {periodos.map((periodo) => <th key={periodo} className="px-3 py-2 text-right font-semibold">{periodo}</th>)}
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {mediosPagoVisibles.map((medio) => {
                  const totalMedio = periodos.reduce((acc, periodo) => acc + (matrizGastosDirectos.get(medio.id)?.get(periodo) ?? 0), 0);
                  const claveFila = `medio:${medio.id}`;
                  const filaExpandida = mostrarDesglose && !!filasExpandidas[claveFila];
                  const gastosFila = gastosDirectosFiltrados.filter((gasto) => gasto.medio_pago_id === medio.id);
                  return <Fragment key={medio.id}>
                  <tr key={medio.id} className="border-t bg-amber-50/40">
                    <td className="px-3 py-2 font-semibold">
                      <button onClick={() => alternarFila(claveFila)} disabled={!mostrarDesglose} className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-xs disabled:opacity-40">{filaExpandida ? '−' : '+'}</button>
                      Gasto directo · {medio.nombre}
                    </td>
                    <td className="px-3 py-2 text-slate-400">—</td>
                    <td className="px-3 py-2 text-right text-slate-400">—</td>
                    <td className="px-3 py-2 text-right text-slate-400">—</td>
                    {periodos.map((periodo) => {
                      const monto = matrizGastosDirectos.get(medio.id)?.get(periodo) ?? 0;
                      const activa = celdaActiva?.tipo === 'gasto_directo' && celdaActiva.clave === medio.id && celdaActiva.periodo === periodo;
                      return <td key={periodo} className="px-3 py-2 text-right tabular-nums"><button onClick={() => manejarClickCelda('gasto_directo', medio.id, periodo, monto)} className={`w-full rounded-lg px-2 py-1 text-right transition ${activa ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : 'hover:bg-slate-100'}`} disabled={monto <= 0}>{monto > 0 ? formatearMonto(monto, 'ARS') : '—'}</button></td>;
                    })}
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatearMonto(totalMedio, 'ARS')}</td>
                  </tr>
                    {filaExpandida && gastosFila.map((gasto) => {
                      const periodoGasto = obtenerPeriodoDesdeFecha(gasto.fecha_gasto);
                      return <tr key={`gasto-${gasto.id}`} className="border-t bg-amber-50/20 align-top">
                        <td className="px-3 py-2 pl-8">
                          <p className="font-medium">{gasto.establecimiento}</p>
                          <p className="text-slate-600">{gasto.descripcion ?? 'Sin descripción'}</p>
                          <p className="text-slate-500">Fecha: {gasto.fecha_gasto.slice(0, 10)} · Categoría: {gasto.categoria?.nombre ?? 'Sin categoría'} · Persona: {gasto.persona ? `${gasto.persona.nombre} ${gasto.persona.apellido ?? ''}`.trim() : 'Sin persona'}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-500">Directo</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatearMonto(gasto.monto, gasto.moneda)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatearMonto(gasto.monto, gasto.moneda)}</td>
                        {periodos.map((periodo) => <td key={`${gasto.id}-${periodo}`} className="px-3 py-2 text-right tabular-nums">{periodo === periodoGasto ? formatearMonto(gasto.monto, gasto.moneda) : '—'}</td>)}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatearMonto(gasto.monto, gasto.moneda)}</td>
                      </tr>;
                    })}
                  </Fragment>;
                })}
                {cuentasVisibles.map((cuenta) => {
                  const totalCuenta = periodos.reduce((acc, periodo) => acc + (matriz.get(cuenta.id)?.get(periodo) ?? 0), 0);
                  const gruposCuenta = desglosePorCuenta.get(cuenta.id) ?? [];
                  const claveFila = `cuenta:${cuenta.id}`;
                  const filaExpandida = mostrarDesglose && gruposCuenta.length > 0 && !!filasExpandidas[claveFila];
                  return (
                    <Fragment key={cuenta.id}>
                    <tr key={cuenta.id} className="border-t">
                        <td className="px-3 py-2 font-semibold">
                          <button onClick={() => alternarFila(claveFila)} disabled={!mostrarDesglose || gruposCuenta.length === 0} className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 bg-white text-xs disabled:opacity-40">{filaExpandida ? '−' : '+'}</button>
                          {cuenta.nombre_cuenta}
                        </td>
                        <td className="px-3 py-2 text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                        {periodos.map((periodo) => {
                          const monto = matriz.get(cuenta.id)?.get(periodo) ?? 0;
                          const activa = celdaActiva?.tipo === 'tarjeta' && celdaActiva.clave === cuenta.id && celdaActiva.periodo === periodo;
                          return (
                            <td key={periodo} className="px-3 py-2 text-right tabular-nums">
                              <button
                                onClick={() => manejarClickCelda('tarjeta', cuenta.id, periodo, monto)}
                                className={`w-full rounded-lg px-2 py-1 text-right transition ${activa ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300' : 'hover:bg-slate-100'}`}
                                disabled={monto <= 0}
                              >
                                {monto > 0 ? formatearMonto(monto, 'ARS') : '—'}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatearMonto(totalCuenta, 'ARS')}</td>
                    </tr>
                      {filaExpandida && gruposCuenta.map((grupo) => {
                        const totalGrupo = periodos.reduce((acc, periodo) => acc + (grupo.montosPorPeriodo.get(periodo) ?? 0), 0);
                        return <tr key={grupo.clave} className="border-t bg-slate-50/60 align-top">
                          <td className="px-3 py-2 pl-8">
                            <p className="font-semibold">{grupo.establecimiento}</p>
                            <p className="text-slate-600">{grupo.descripcion}</p>
                            <p className="text-slate-500">Persona: {grupo.personaId ? nombresPersonas.get(grupo.personaId) ?? 'Sin persona' : 'Sin persona'} · Tarjeta: {grupo.tarjetaFisicaId ? nombresTarjetas.get(grupo.tarjetaFisicaId) ?? 'Sin tarjeta' : 'Sin tarjeta'}</p>
                            <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${BADGE_ORIGEN[grupo.origen] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>origen: {grupo.origen}</span>
                          </td>
                          <td className="px-3 py-2">{grupo.cuotasPendientes}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatearMonto(grupo.montoCuotaReferencia, grupo.moneda)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatearMonto(grupo.totalPendienteVisible, grupo.moneda)}</td>
                          {periodos.map((periodo) => {
                            const monto = grupo.montosPorPeriodo.get(periodo) ?? 0;
                            return <td key={`${grupo.clave}-${periodo}`} className="px-3 py-2 text-right tabular-nums">{monto > 0 ? formatearMonto(monto, grupo.moneda) : '—'}</td>;
                          })}
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatearMonto(totalGrupo, grupo.moneda)}</td>
                        </tr>;
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
              <tfoot className="border-t bg-slate-50 font-semibold">
                <tr>
                  <td className="px-3 py-2">Total a reservar</td>
                  <td />
                  <td />
                  <td />
                  {periodos.map((periodo) => <td key={periodo} className="px-3 py-2 text-right">{formatearMonto(totalesPorMes.get(periodo) ?? 0, 'ARS')}</td>)}
                  <td className="px-3 py-2 text-right">{formatearMonto(totalGeneralVisible, 'ARS')}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {mediosPagoVisibles.map((medio) => (
              <article key={medio.id} className="rounded-2xl border bg-amber-50/50 p-3">
                <button disabled={!mostrarDesglose} onClick={() => alternarFila(`medio:${medio.id}`)} className="flex w-full items-center justify-between text-left">
                  <h3 className="font-semibold">Gasto directo · {medio.nombre}</h3>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded border bg-white text-xs">{mostrarDesglose && filasExpandidas[`medio:${medio.id}`] ? '−' : '+'}</span>
                </button>
                <div className="mt-2 space-y-2">
                  {periodos.map((periodo) => {
                    const monto = matrizGastosDirectos.get(medio.id)?.get(periodo) ?? 0;
                    return <button key={periodo} onClick={() => manejarClickCelda('gasto_directo', medio.id, periodo, monto)} className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"><span>{periodo}</span><span className="font-semibold">{monto > 0 ? formatearMonto(monto, 'ARS') : '—'}</span></button>;
                  })}
                </div>
                {mostrarDesglose && filasExpandidas[`medio:${medio.id}`] && (
                  <div className="mt-3 space-y-2">
                    {gastosDirectosFiltrados.filter((gasto) => gasto.medio_pago_id === medio.id).map((gasto) => (
                      <article key={gasto.id} className="rounded-xl border bg-white p-2 text-xs">
                        <p className="font-semibold">{gasto.establecimiento}</p>
                        <p className="text-slate-600">{gasto.descripcion ?? 'Sin descripción'}</p>
                        <p className="text-slate-500">{gasto.fecha_gasto.slice(0, 10)} · {gasto.categoria?.nombre ?? 'Sin categoría'} · {formatearMonto(gasto.monto, gasto.moneda)}</p>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {cuentasVisibles.map((cuenta) => (
              <article key={cuenta.id} className="rounded-2xl border bg-white p-3">
                <button disabled={!mostrarDesglose} onClick={() => alternarFila(`cuenta:${cuenta.id}`)} className="flex w-full items-center justify-between text-left">
                  <h3 className="font-semibold">{cuenta.nombre_cuenta}</h3>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded border bg-white text-xs">{mostrarDesglose && filasExpandidas[`cuenta:${cuenta.id}`] ? '−' : '+'}</span>
                </button>
                <div className="mt-2 space-y-2">
                  {periodos.map((periodo) => {
                    const monto = matriz.get(cuenta.id)?.get(periodo) ?? 0;
                    return <button key={periodo} onClick={() => manejarClickCelda('tarjeta', cuenta.id, periodo, monto)} className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm"><span>{periodo}</span><span className="font-semibold">{monto > 0 ? formatearMonto(monto, 'ARS') : '—'}</span></button>;
                  })}
                </div>
                {mostrarDesglose && filasExpandidas[`cuenta:${cuenta.id}`] && (
                  <div className="mt-3 space-y-3">
                    {(desglosePorCuenta.get(cuenta.id) ?? []).map((grupo) => (<article key={grupo.clave} className="rounded-xl border bg-slate-50 p-2 text-xs"><p className="font-semibold">{grupo.establecimiento}</p><p className="text-slate-600">{grupo.descripcion} · {grupo.cuotasPendientes}</p><div className="mt-1 grid grid-cols-2 gap-1">{periodos.map((periodo) => <div key={periodo} className="rounded border bg-white px-2 py-1"><p className="text-[11px] text-slate-500">{periodo}</p><p className="font-semibold">{(grupo.montosPorPeriodo.get(periodo) ?? 0) > 0 ? formatearMonto(grupo.montosPorPeriodo.get(periodo) ?? 0, grupo.moneda) : '—'}</p></div>)}</div></article>))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}

      {celdaActiva && (
        <section className="space-y-2 rounded-2xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Detalle de {celdaActiva.tipo === 'tarjeta' ? cuentaActiva?.nombre_cuenta ?? 'Cuenta' : `Gasto directo · ${nombresMediosPago.get(celdaActiva.clave) ?? 'Medio de pago'}`} · {celdaActiva.periodo}</h2>
            <button onClick={() => setCeldaActiva(null)} className="rounded-lg border px-2 py-1 text-xs">Cerrar</button>
          </div>
          {celdaActiva.tipo === 'tarjeta' && (detalleCelda.length === 0 ? <p className="text-sm text-slate-600">No hay cuotas para esta combinación.</p> : (
            <DetalleCuotasLista cuotas={detalleCelda} nombresPersonas={nombresPersonas} nombresTarjetas={nombresTarjetas} />
          ))}
          {celdaActiva.tipo === 'gasto_directo' && (detalleDirectoCelda.length === 0 ? <p className="text-sm text-slate-600">No hay gastos para esta combinación.</p> : <DetalleGastosDirectosLista gastos={detalleDirectoCelda} />)}
        </section>
      )}
    </section>
  );
}


function DetalleCuotasLista({
  cuotas,
  nombresPersonas,
  nombresTarjetas,
}: {
  cuotas: CuotaTarjeta[];
  nombresPersonas: Map<string, string>;
  nombresTarjetas: Map<string, string>;
}) {
  const etiquetaCuota = (numeroCuota: number, totalCuotas: number) => (totalCuotas === 1 ? 'Pago único' : `${numeroCuota}/${totalCuotas}`);
  return (
    <div className="space-y-2">
      {cuotas.map((cuota) => (
        <article key={cuota.id} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{cuota.establecimiento}</p>
            <p className="text-right font-semibold tabular-nums">{formatearMonto(cuota.monto_cuota, cuota.moneda)}</p>
          </div>
          <p className="text-sm text-slate-600">{cuota.descripcion_cuota ?? 'Sin descripción'} · {etiquetaCuota(cuota.numero_cuota, cuota.total_cuotas)}</p>
          <p className="text-sm text-slate-600">Persona: {cuota.persona_id ? nombresPersonas.get(cuota.persona_id) ?? 'Sin persona' : 'Sin persona'} · Tarjeta: {cuota.tarjeta_fisica_id ? nombresTarjetas.get(cuota.tarjeta_fisica_id) ?? 'Sin tarjeta' : 'Sin tarjeta'}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full border px-2 py-1 ${BADGE_ORIGEN[cuota.origen_cuota] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>origen: {cuota.origen_cuota}</span>
            <span className={`rounded-full border px-2 py-1 ${BADGE_ESTADO[cuota.estado] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>{cuota.estado}</span>
          </div>
          {cuota.observaciones && <p className="mt-2 text-xs text-slate-500">Obs: {cuota.observaciones}</p>}
        </article>
      ))}
    </div>
  );
}

function DetalleGastosDirectosLista({ gastos }: { gastos: GastoDirecto[] }) {
  return <div className="space-y-2">{gastos.map((gasto) => <article key={gasto.id} className="rounded-xl border p-3">
    <div className="flex items-center justify-between gap-2">
      <p className="font-medium">{gasto.establecimiento}</p>
      <p className="font-semibold tabular-nums">{formatearMonto(gasto.monto, gasto.moneda)}</p>
    </div>
    <p className="text-sm text-slate-600">{gasto.fecha_gasto} · {gasto.categoria?.nombre ?? 'Sin categoría'} · {gasto.medio_pago?.nombre ?? 'Sin medio de pago'}</p>
    <p className="text-sm text-slate-600">Persona: {gasto.persona ? `${gasto.persona.nombre} ${gasto.persona.apellido ?? ''}`.trim() : 'Sin persona'}</p>
    {gasto.descripcion && <p className="text-sm text-slate-600">Descripción: {gasto.descripcion}</p>}
    {gasto.observaciones && <p className="text-xs text-slate-500">Obs: {gasto.observaciones}</p>}
  </article>)}</div>;
}

function CardTitulo({ titulo, valor, destacado = false }: { titulo: string; valor: string; destacado?: boolean }) {
  return (
    <article className={`rounded-2xl border p-3 ${destacado ? 'border-emerald-200 bg-emerald-50' : 'bg-white'}`}>
      <p className="text-xs uppercase tracking-wide text-slate-600">{titulo}</p>
      <p className="mt-1 text-xl font-semibold">{valor}</p>
    </article>
  );
}
