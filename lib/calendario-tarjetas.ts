import { SupabaseClient } from '@supabase/supabase-js';
import { construirFechaCierreEstimada, construirFechaVencimientoEstimada } from '@/utils/tarjetas';

export type EstadoCalendario = 'estimado' | 'confirmado' | 'importado' | 'modificado_manual';
export type OrigenFecha = 'manual' | 'calculado' | 'importado' | 'resumen_banco';

export type CalendarioTarjetaDB = {
  id: string;
  grupo_id?: string | null;
  cuenta_tarjeta_id: string;
  periodo_resumen: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  estado_calendario: EstadoCalendario;
  origen_fecha: OrigenFecha;
  observaciones: string | null;
  creado_en?: string;
};

type CuentaCalendario = {
  id: string;
  grupo_id?: string | null;
  nombre_cuenta?: string | null;
  dia_cierre_habitual: number | null;
  dias_hasta_vencimiento: number | null;
};

type ContextoCalendario = 'gasto' | 'conversion' | 'calendario';

function prioridad(item: CalendarioTarjetaDB) {
  if (item.estado_calendario === 'confirmado' || item.estado_calendario === 'modificado_manual') return 0;
  if (item.origen_fecha === 'manual') return 1;
  if (item.estado_calendario === 'importado') return 2;
  return 3;
}

function elegirPrincipal(duplicados: CalendarioTarjetaDB[]) {
  return [...duplicados].sort((a, b) => {
    const diff = prioridad(a) - prioridad(b);
    if (diff !== 0) return diff;
    if (a.creado_en && b.creado_en) return a.creado_en.localeCompare(b.creado_en);
    return a.id.localeCompare(b.id);
  })[0];
}

function observacionPorContexto(contexto: ContextoCalendario) {
  if (contexto === 'conversion') return 'Calendario generado automáticamente al convertir un gasto a tarjeta de crédito.';
  if (contexto === 'calendario') return 'Calendario generado automáticamente al crear períodos futuros.';
  return 'Calendario generado automáticamente al registrar un gasto.';
}

export async function consolidarDuplicadosCalendario(
  supabase: SupabaseClient,
  duplicados: CalendarioTarjetaDB[],
  grupoId?: string | null,
): Promise<{ principal: CalendarioTarjetaDB; eliminados: number; pendiente: boolean }> {
  const principal = elegirPrincipal(duplicados);
  const secundarios = duplicados.filter((item) => item.id !== principal.id);
  let principalActualizado = principal;

  const obsPrincipal = principal.observaciones?.trim() ?? '';
  if (!obsPrincipal) {
    const obsSecundaria = secundarios.find((item) => (item.observaciones?.trim()?.length ?? 0) > 0)?.observaciones?.trim();
    if (obsSecundaria) {
      let actualizar = supabase
        .from('calendario_tarjetas')
        .update({ observaciones: obsSecundaria, actualizado_en: new Date().toISOString() })
        .eq('id', principal.id);
      if (grupoId ?? principal.grupo_id) actualizar = actualizar.eq('grupo_id', grupoId ?? principal.grupo_id);
      const { data, error } = await actualizar
        .select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones,creado_en')
        .single();
      if (!error && data) principalActualizado = data as CalendarioTarjetaDB;
    }
  }

  let eliminados = 0;
  let pendiente = false;
  for (const secundario of secundarios) {
    let borrar = supabase.from('calendario_tarjetas').delete().eq('id', secundario.id);
    if (grupoId ?? secundario.grupo_id) borrar = borrar.eq('grupo_id', grupoId ?? secundario.grupo_id);
    const { error } = await borrar;
    if (error) {
      console.warn('No se pudo eliminar calendario duplicado de forma automática', {
        calendario_id: secundario.id,
        cuenta_tarjeta_id: secundario.cuenta_tarjeta_id,
        periodo_resumen: secundario.periodo_resumen,
      });
      pendiente = true;
      continue;
    }
    eliminados += 1;
  }

  return { principal: principalActualizado, eliminados, pendiente };
}

export async function obtenerOCrearCalendarioEstimado(params: {
  supabase: SupabaseClient;
  cuenta: CuentaCalendario;
  periodo: string;
  contexto?: ContextoCalendario;
  grupoId?: string | null;
}) {
  const { supabase, cuenta, periodo, contexto = 'gasto' } = params;
  const grupoId = params.grupoId ?? cuenta.grupo_id ?? null;

  let consulta = supabase
    .from('calendario_tarjetas')
    .select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones,creado_en')
    .eq('cuenta_tarjeta_id', cuenta.id)
    .eq('periodo_resumen', periodo);
  if (grupoId) consulta = consulta.eq('grupo_id', grupoId);
  const { data: existentes, error } = await consulta.order('creado_en', { ascending: true });

  if (error) throw new Error('No se pudo consultar calendario de tarjetas.');

  const encontrados = (existentes ?? []) as CalendarioTarjetaDB[];
  if (encontrados.length > 1) {
    const consolidacion = await consolidarDuplicadosCalendario(supabase, encontrados, grupoId);
    return { calendario: consolidacion.principal, generado: false, consolidados: consolidacion.eliminados, pendientes: consolidacion.pendiente ? 1 : 0 };
  }

  if (encontrados.length === 1) return { calendario: encontrados[0], generado: false, consolidados: 0, pendientes: 0 };

  if (!cuenta.dia_cierre_habitual || cuenta.dias_hasta_vencimiento === null) {
    const nombreCuenta = cuenta.nombre_cuenta?.trim() || 'sin nombre';
    throw new Error(`La cuenta ${nombreCuenta} no tiene configurado el día de cierre habitual o los días hasta vencimiento. Completalos en Tarjetas para que SpendFlow Planner pueda crear calendarios automáticamente.`);
  }

  const fecha_cierre = construirFechaCierreEstimada(periodo, cuenta.dia_cierre_habitual);
  const fecha_vencimiento = construirFechaVencimientoEstimada(fecha_cierre, cuenta.dias_hasta_vencimiento);
  const payload = {
    ...(grupoId ? { grupo_id: grupoId } : {}),
    cuenta_tarjeta_id: cuenta.id,
    periodo_resumen: periodo,
    fecha_cierre,
    fecha_vencimiento,
    estado_calendario: 'estimado',
    origen_fecha: 'calculado',
    observaciones: observacionPorContexto(contexto),
  };
  const { data, error: err } = await supabase
    .from('calendario_tarjetas')
    .insert(payload)
    .select('id,cuenta_tarjeta_id,periodo_resumen,fecha_cierre,fecha_vencimiento,estado_calendario,origen_fecha,observaciones,creado_en')
    .single();
  if (err || !data) throw new Error('No se pudo generar el calendario estimado automáticamente.');
  return { calendario: data as CalendarioTarjetaDB, generado: true, consolidados: 0, pendientes: 0 };
}
