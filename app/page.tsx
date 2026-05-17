'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Gasto = {
  id: string;
  monto: number;
  fecha_gasto: string;
  establecimiento: string;
  estado_registro: string;
  categoria_id: string | null;
  medio_pago_id: string | null;
  persona_id: string | null;
};

type CuotaTarjeta = {
  id: string;
  monto_cuota: number;
  periodo_pago_estimado: string;
  estado: string;
  cuenta_tarjeta_id: string;
};

type Categoria = { id: string; nombre: string };
type MedioPago = { id: string; nombre: string };
type Persona = { id: string; nombre: string; apellido: string | null };
type CuentaTarjeta = { id: string; nombre_cuenta: string };

type FilaResumen = {
  id: string;
  nombre: string;
  total: number;
  cantidad: number;
};

const ESTADOS_CUOTA_EXCLUIDOS = ['cancelada', 'pagada'];

function obtenerPeriodoActual() {
  const hoy = new Date();
  return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
}

function obtenerSiguientePeriodo(periodo: string) {
  const [anioRaw, mesRaw] = periodo.split('-');
  const anio = Number(anioRaw);
  const mes = Number(mesRaw);
  const siguiente = new Date(Date.UTC(anio, mes, 1));
  return `${siguiente.getUTCFullYear()}-${String(siguiente.getUTCMonth() + 1).padStart(2, '0')}`;
}

function obtenerLimitesMes(periodo: string) {
  const [anioRaw, mesRaw] = periodo.split('-');
  const anio = Number(anioRaw);
  const mes = Number(mesRaw);
  const inicio = `${periodo}-01`;
  const fin = new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
  return { inicio, fin };
}

function formatearMonto(monto: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto);
}

function badgeBase() {
  return 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-slate-50 text-slate-700 border-slate-200';
}

export default function DashboardPage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(obtenerPeriodoActual());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cuotasMes, setCuotasMes] = useState<CuotaTarjeta[]>([]);
  const [cuotasProximoMes, setCuotasProximoMes] = useState<CuotaTarjeta[]>([]);

  const [categorias, setCategorias] = useState<Map<string, string>>(new Map());
  const [mediosPago, setMediosPago] = useState<Map<string, string>>(new Map());
  const [personas, setPersonas] = useState<Map<string, string>>(new Map());
  const [cuentasTarjeta, setCuentasTarjeta] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    void cargarDashboard(mesSeleccionado);
  }, [mesSeleccionado]);

  async function cargarDashboard(periodo: string) {
    setCargando(true);
    setError(null);

    const { inicio, fin } = obtenerLimitesMes(periodo);
    const proximoPeriodo = obtenerSiguientePeriodo(periodo);

    const [
      gastosRes,
      cuotasMesRes,
      cuotasProximoRes,
      categoriasRes,
      mediosRes,
      personasRes,
      cuentasRes,
    ] = await Promise.all([
      supabase
        .from('gastos')
        .select('id,monto,fecha_gasto,establecimiento,estado_registro,categoria_id,medio_pago_id,persona_id')
        .neq('estado_registro', 'anulado')
        .gte('fecha_gasto', inicio)
        .lte('fecha_gasto', fin),
      supabase
        .from('cuotas_tarjeta')
        .select('id,monto_cuota,periodo_pago_estimado,estado,cuenta_tarjeta_id')
        .eq('periodo_pago_estimado', periodo)
        .not('estado', 'in', `(${ESTADOS_CUOTA_EXCLUIDOS.join(',')})`),
      supabase
        .from('cuotas_tarjeta')
        .select('id,monto_cuota,periodo_pago_estimado,estado,cuenta_tarjeta_id')
        .eq('periodo_pago_estimado', proximoPeriodo)
        .not('estado', 'in', `(${ESTADOS_CUOTA_EXCLUIDOS.join(',')})`),
      supabase.from('categorias').select('id,nombre'),
      supabase.from('medios_pago').select('id,nombre'),
      supabase.from('personas').select('id,nombre,apellido'),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta'),
    ]);

    if (
      gastosRes.error ||
      cuotasMesRes.error ||
      cuotasProximoRes.error ||
      categoriasRes.error ||
      mediosRes.error ||
      personasRes.error ||
      cuentasRes.error
    ) {
      const primerError =
        gastosRes.error ??
        cuotasMesRes.error ??
        cuotasProximoRes.error ??
        categoriasRes.error ??
        mediosRes.error ??
        personasRes.error ??
        cuentasRes.error;

      console.error(primerError);
      setError('No se pudo cargar el dashboard. Revisá la conexión con Supabase.');
      setCargando(false);
      return;
    }

    setGastos((gastosRes.data ?? []) as Gasto[]);
    setCuotasMes((cuotasMesRes.data ?? []) as CuotaTarjeta[]);
    setCuotasProximoMes((cuotasProximoRes.data ?? []) as CuotaTarjeta[]);

    setCategorias(new Map(((categoriasRes.data ?? []) as Categoria[]).map((c) => [c.id, c.nombre])));
    setMediosPago(new Map(((mediosRes.data ?? []) as MedioPago[]).map((m) => [m.id, m.nombre])));
    setPersonas(new Map(((personasRes.data ?? []) as Persona[]).map((p) => [p.id, `${p.nombre} ${p.apellido ?? ''}`.trim()])));
    setCuentasTarjeta(new Map(((cuentasRes.data ?? []) as CuentaTarjeta[]).map((c) => [c.id, c.nombre_cuenta])));

    setCargando(false);
  }

  const gastoTotalMes = useMemo(() => gastos.reduce((acc, gasto) => acc + gasto.monto, 0), [gastos]);
  const totalReservarMes = useMemo(() => cuotasMes.reduce((acc, cuota) => acc + cuota.monto_cuota, 0), [cuotasMes]);
  const comprometidoProximoMes = useMemo(
    () => cuotasProximoMes.reduce((acc, cuota) => acc + cuota.monto_cuota, 0),
    [cuotasProximoMes],
  );

  function resumirPorCampo(items: Gasto[], obtenerId: (item: Gasto) => string | null, nombres: Map<string, string>): FilaResumen[] {
    const acumulado = new Map<string, FilaResumen>();

    for (const item of items) {
      const id = obtenerId(item) ?? 'sin-dato';
      const nombre = id === 'sin-dato' ? 'Sin asignar' : (nombres.get(id) ?? 'Sin asignar');
      const previo = acumulado.get(id);

      if (!previo) {
        acumulado.set(id, { id, nombre, total: item.monto, cantidad: 1 });
        continue;
      }

      previo.total += item.monto;
      previo.cantidad += 1;
    }

    return Array.from(acumulado.values()).sort((a, b) => b.total - a.total);
  }

  const porCategoria = useMemo(() => resumirPorCampo(gastos, (g) => g.categoria_id, categorias), [gastos, categorias]);
  const porMedioPago = useMemo(() => resumirPorCampo(gastos, (g) => g.medio_pago_id, mediosPago), [gastos, mediosPago]);
  const porPersona = useMemo(() => resumirPorCampo(gastos, (g) => g.persona_id, personas), [gastos, personas]);

  const topEstablecimientos = useMemo(() => {
    const acumulado = new Map<string, FilaResumen>();
    for (const gasto of gastos) {
      const clave = gasto.establecimiento?.trim() || 'Sin establecimiento';
      const previo = acumulado.get(clave);
      if (!previo) {
        acumulado.set(clave, { id: clave, nombre: clave, total: gasto.monto, cantidad: 1 });
        continue;
      }
      previo.total += gasto.monto;
      previo.cantidad += 1;
    }
    return Array.from(acumulado.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [gastos]);

  const cuentasComprometidas = useMemo(() => {
    const acumulado = new Map<string, FilaResumen>();
    for (const cuota of cuotasMes) {
      const clave = cuota.cuenta_tarjeta_id;
      const nombre = cuentasTarjeta.get(clave) ?? 'Cuenta desconocida';
      const previo = acumulado.get(clave);
      if (!previo) {
        acumulado.set(clave, { id: clave, nombre, total: cuota.monto_cuota, cantidad: 1 });
        continue;
      }
      previo.total += cuota.monto_cuota;
      previo.cantidad += 1;
    }
    return Array.from(acumulado.values()).sort((a, b) => b.total - a.total);
  }, [cuotasMes, cuentasTarjeta]);

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
            <p className="text-sm text-slate-600">Resumen ejecutivo mensual de SpendWise.</p>
          </div>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Mes
            <input
              type="month"
              value={mesSeleccionado}
              onChange={(e) => setMesSeleccionado(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-500"
            />
          </label>
        </div>
      </header>

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CardMetrica titulo="Gastos del mes" valor={formatearMonto(gastoTotalMes)} subtitulo="Suma de gastos no anulados" />
        <CardMetrica titulo="Tarjetas a reservar este mes" valor={formatearMonto(totalReservarMes)} subtitulo="Cuotas pendientes del período" />
        <CardMetrica titulo="Comprometido próximo mes" valor={formatearMonto(comprometidoProximoMes)} subtitulo={obtenerSiguientePeriodo(mesSeleccionado)} />
        <CardMetrica titulo="Gastos registrados" valor={String(gastos.length)} subtitulo="Cantidad de gastos del mes" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CardMetrica titulo="Cuotas visibles" valor={String(cuotasMes.length)} subtitulo="Cuotas pendientes del mes" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CardListado titulo="Gastos por categoría" filas={porCategoria} vacio="Todavía no hay gastos registrados para este mes." />
        <CardListado titulo="Gastos por medio de pago" filas={porMedioPago} vacio="Todavía no hay gastos registrados para este mes." />
        <CardListado titulo="Gastos por persona" filas={porPersona} vacio="Todavía no hay gastos registrados para este mes." />
        <CardListado titulo="Top establecimientos" filas={topEstablecimientos} vacio="Todavía no hay gastos registrados para este mes." />
        <CardListado titulo="Cuentas de tarjeta comprometidas" filas={cuentasComprometidas} vacio="No hay pagos de tarjeta proyectados para este mes." />
      </div>

      {cargando ? <p className="text-sm text-slate-500">Cargando dashboard...</p> : null}
    </section>
  );
}

function CardMetrica({ titulo, valor, subtitulo }: { titulo: string; valor: string; subtitulo: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-600">{titulo}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitulo}</p>
    </article>
  );
}

function CardListado({ titulo, filas, vacio }: { titulo: string; filas: FilaResumen[]; vacio: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{vacio}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {filas.map((fila) => (
            <li key={fila.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-2">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="truncate text-sm font-medium text-slate-800">{fila.nombre}</p>
                <span className={badgeBase()}>{fila.cantidad} mov.</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatearMonto(fila.total)}</p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
