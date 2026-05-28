'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';

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
  tarjeta_fisica_id: string | null;
  persona_id: string;
  establecimiento: string;
  descripcion_cuota: string;
  numero_cuota: number;
  total_cuotas: number;
  origen_cuota: string;
  observaciones: string | null;
};

type Categoria = { id: string; nombre: string };
type MedioPago = { id: string; nombre: string };
type Persona = { id: string; nombre: string; apellido: string | null };
type CuentaTarjeta = { id: string; nombre_cuenta: string };
type TarjetaFisica = { id: string; alias: string | null; ultimos_4_digitos: string | null };

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

function formatearPeriodoLargo(periodo: string) {
  const [anioRaw, mesRaw] = periodo.split('-');
  const anio = Number(anioRaw);
  const mes = Number(mesRaw);
  if (Number.isNaN(anio) || Number.isNaN(mes)) return periodo;
  const fecha = new Date(Date.UTC(anio, mes - 1, 1));
  return new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(fecha);
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
  const [tarjetasFisicas, setTarjetasFisicas] = useState<Map<string, string>>(new Map());
  const [detalleCuotasAbierto, setDetalleCuotasAbierto] = useState(false);

  useEffect(() => {
    void cargarDashboard(mesSeleccionado);
  }, [mesSeleccionado]);

  async function cargarDashboard(periodo: string) {
    setCargando(true);
    setError(null);

    const { inicio, fin } = obtenerLimitesMes(periodo);
    const proximoPeriodo = obtenerSiguientePeriodo(periodo);

    const perfil = await obtenerPerfilActivo();
    if (process.env.NODE_ENV !== 'production') console.debug('[dashboard] grupo activo', { email: perfil.email, grupo_id: perfil.grupo_id });

    const [
      gastosRes,
      cuotasMesRes,
      cuotasProximoRes,
      categoriasRes,
      mediosRes,
      personasRes,
      cuentasRes,
      tarjetasRes,
    ] = await Promise.all([
      supabase
        .from('gastos')
        .select('id,monto,fecha_gasto,establecimiento,estado_registro,categoria_id,medio_pago_id,persona_id')
        .neq('estado_registro', 'anulado')
        .gte('fecha_gasto', inicio)
        .lte('fecha_gasto', fin)
        .eq('grupo_id', perfil.grupo_id),
      supabase
        .from('cuotas_tarjeta')
        .select('id,monto_cuota,periodo_pago_estimado,estado,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,establecimiento,descripcion_cuota,numero_cuota,total_cuotas,origen_cuota,observaciones')
        .eq('periodo_pago_estimado', periodo)
        .not('estado', 'in', `(${ESTADOS_CUOTA_EXCLUIDOS.join(',')})`)
        .eq('grupo_id', perfil.grupo_id),
      supabase
        .from('cuotas_tarjeta')
        .select('id,monto_cuota,periodo_pago_estimado,estado,cuenta_tarjeta_id,tarjeta_fisica_id,persona_id,establecimiento,descripcion_cuota,numero_cuota,total_cuotas,origen_cuota,observaciones')
        .eq('periodo_pago_estimado', proximoPeriodo)
        .not('estado', 'in', `(${ESTADOS_CUOTA_EXCLUIDOS.join(',')})`)
        .eq('grupo_id', perfil.grupo_id),
      supabase.from('categorias').select('id,nombre').eq('grupo_id', perfil.grupo_id),
      supabase.from('medios_pago').select('id,nombre').eq('grupo_id', perfil.grupo_id),
      supabase.from('personas').select('id,nombre,apellido').eq('grupo_id', perfil.grupo_id),
      supabase.from('cuentas_tarjeta').select('id,nombre_cuenta').eq('grupo_id', perfil.grupo_id),
      supabase.from('tarjetas_fisicas').select('id,alias,ultimos_4_digitos').eq('grupo_id', perfil.grupo_id),
    ]);

    if (
      gastosRes.error ||
      cuotasMesRes.error ||
      cuotasProximoRes.error ||
      categoriasRes.error ||
      mediosRes.error ||
      personasRes.error ||
      cuentasRes.error ||
      tarjetasRes.error
    ) {
      const primerError =
        gastosRes.error ??
        cuotasMesRes.error ??
        cuotasProximoRes.error ??
        categoriasRes.error ??
        mediosRes.error ??
        personasRes.error ??
        cuentasRes.error ??
        tarjetasRes.error;

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
    setTarjetasFisicas(new Map(((tarjetasRes.data ?? []) as TarjetaFisica[]).map((t) => [t.id, `${t.alias ?? 'Tarjeta sin alias'}${t.ultimos_4_digitos ? ` · ${t.ultimos_4_digitos}` : ''}`])));

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

  const cuotasAgrupadasPorCuenta = useMemo(() => {
    const acumulado = new Map<string, CuotaTarjeta[]>();
    for (const cuota of cuotasMes) {
      const key = cuota.cuenta_tarjeta_id;
      const actuales = acumulado.get(key) ?? [];
      actuales.push(cuota);
      acumulado.set(key, actuales);
    }
    return Array.from(acumulado.entries()).map(([cuentaId, cuotas]) => ({
      cuentaId,
      nombreCuenta: cuentasTarjeta.get(cuentaId) ?? 'Cuenta desconocida',
      cuotas: cuotas.sort((a, b) => a.numero_cuota - b.numero_cuota || a.establecimiento.localeCompare(b.establecimiento)),
      total: cuotas.reduce((acc, cuota) => acc + cuota.monto_cuota, 0),
    })).sort((a, b) => b.total - a.total);
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
        <CardMetrica
          titulo="Cuotas visibles"
          valor={String(cuotasMes.length)}
          subtitulo={detalleCuotasAbierto ? 'Click para ocultar detalle' : 'Click para ver detalle'}
          esInteractiva
          onClick={() => setDetalleCuotasAbierto((valorActual) => !valorActual)}
        />
      </div>

      {detalleCuotasAbierto ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Cuotas pendientes de {formatearPeriodoLargo(mesSeleccionado)}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {cuotasMes.length} cuotas · Total {formatearMonto(totalReservarMes)}
              </p>
            </div>
          </div>
          {cuotasMes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No hay cuotas pendientes para este mes.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {cuotasAgrupadasPorCuenta.map((grupo) => (
                <section key={grupo.cuentaId} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">{grupo.nombreCuenta}</h3>
                    <span className={badgeBase()}>{grupo.cuotas.length} cuotas · {formatearMonto(grupo.total)}</span>
                  </div>
                  <ul className="space-y-2">
                    {grupo.cuotas.map((cuota) => (
                      <li key={cuota.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div className="grid gap-1 sm:grid-cols-2">
                          <p><span className="font-medium">Establecimiento:</span> {cuota.establecimiento}</p>
                          <p><span className="font-medium">Descripción:</span> {cuota.descripcion_cuota}</p>
                          <p><span className="font-medium">Tarjeta física:</span> {cuota.tarjeta_fisica_id ? (tarjetasFisicas.get(cuota.tarjeta_fisica_id) ?? 'Sin dato') : 'Sin tarjeta específica'}</p>
                          <p><span className="font-medium">Persona:</span> {personas.get(cuota.persona_id) ?? 'Sin dato'}</p>
                          <p><span className="font-medium">Cuota:</span> {cuota.numero_cuota}/{cuota.total_cuotas}</p>
                          <p><span className="font-medium">Monto:</span> {formatearMonto(cuota.monto_cuota)}</p>
                          <p><span className="font-medium">Origen:</span> {cuota.origen_cuota}</p>
                          <p><span className="font-medium">Estado:</span> {cuota.estado}</p>
                        </div>
                        {cuota.observaciones ? <p className="mt-2 text-xs text-slate-600"><span className="font-medium">Observaciones:</span> {cuota.observaciones}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </article>
      ) : null}

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

function CardMetrica({ titulo, valor, subtitulo, esInteractiva = false, onClick }: { titulo: string; valor: string; subtitulo: string; esInteractiva?: boolean; onClick?: () => void }) {
  return (
    <article
      onClick={onClick}
      className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${esInteractiva ? 'cursor-pointer transition hover:border-slate-400 hover:shadow' : ''}`}
      role={esInteractiva ? 'button' : undefined}
      tabIndex={esInteractiva ? 0 : undefined}
      onKeyDown={esInteractiva ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); } : undefined}
    >
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
