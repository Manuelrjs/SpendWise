'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Persona = { id: string; nombre: string; apellido: string | null; activo: boolean };
type CuentaTarjeta = { id: string; nombre_cuenta: string; banco: string | null; marca: string | null; persona_titular_id: string; activo: boolean; color_ui: string | null; icono_ui: string | null; dia_cierre_habitual: number | null; dias_hasta_vencimiento: number | null; observaciones: string | null; creado_en: string; persona_titular: Persona | null };
type TipoTarjetaFisica = 'titular' | 'adicional';
type TarjetaFisica = { id: string; cuenta_tarjeta_id: string; persona_id: string; tipo: TipoTarjetaFisica; nombre_en_tarjeta: string | null; alias: string | null; ultimos_4_digitos: string | null; activo: boolean; observaciones: string | null; creado_en: string; persona: Persona | null };

type FormularioCuenta = { nombre_cuenta: string; banco: string; marca: string; persona_titular_id: string; color_ui: string; icono_ui: string; dia_cierre_habitual: string; dias_hasta_vencimiento: string; observaciones: string };
type FormularioTarjeta = { cuenta_tarjeta_id: string; persona_id: string; tipo: TipoTarjetaFisica; nombre_en_tarjeta: string; alias: string; ultimos_4_digitos: string; observaciones: string };

const estadoInicialCuenta: FormularioCuenta = { nombre_cuenta: '', banco: '', marca: '', persona_titular_id: '', color_ui: '', icono_ui: '', dia_cierre_habitual: '', dias_hasta_vencimiento: '', observaciones: '' };
const estadoInicialTarjeta: FormularioTarjeta = { cuenta_tarjeta_id: '', persona_id: '', tipo: 'titular', nombre_en_tarjeta: '', alias: '', ultimos_4_digitos: '', observaciones: '' };

function nombrePersona(persona: Persona | null | undefined) { if (!persona) return 'Sin titular'; return `${persona.nombre}${persona.apellido ? ` ${persona.apellido}` : ''}`; }

export default function Page() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [guardandoTarjeta, setGuardandoTarjeta] = useState(false);
  const [cuentaEditandoId, setCuentaEditandoId] = useState<string | null>(null);
  const [tarjetaEditandoId, setTarjetaEditandoId] = useState<string | null>(null);
  const [modalTarjetaAbierto, setModalTarjetaAbierto] = useState(false);
  const [formCuenta, setFormCuenta] = useState<FormularioCuenta>(estadoInicialCuenta);
  const [formTarjeta, setFormTarjeta] = useState<FormularioTarjeta>(estadoInicialTarjeta);
  const [errorCuenta, setErrorCuenta] = useState('');
  const [errorTarjeta, setErrorTarjeta] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const tituloCuenta = useMemo(() => (cuentaEditandoId ? 'Editar cuenta de tarjeta' : 'Nueva cuenta de tarjeta'), [cuentaEditandoId]);
  const cuentaSeleccionadaTarjeta = useMemo(() => cuentas.find((c) => c.id === formTarjeta.cuenta_tarjeta_id), [cuentas, formTarjeta.cuenta_tarjeta_id]);
  const tituloTarjeta = useMemo(() => {
    const accion = tarjetaEditandoId ? 'Editar tarjeta física' : 'Nueva tarjeta física';
    if (!cuentaSeleccionadaTarjeta) return accion;
    return `${accion} para ${cuentaSeleccionadaTarjeta.nombre_cuenta}`;
  }, [cuentaSeleccionadaTarjeta, tarjetaEditandoId]);

  async function cargarDatos() {
    setCargando(true); setMensaje(null);
    const [{ data: dataPersonas, error: errorPersonas }, { data: dataCuentas, error: errorCuentas }, { data: dataTarjetas, error: errorTarjetas }] = await Promise.all([
      supabase.from('personas').select('id, nombre, apellido, activo').order('nombre', { ascending: true }),
      supabase.from('cuentas_tarjeta').select('id, nombre_cuenta, banco, marca, persona_titular_id, activo, color_ui, icono_ui, dia_cierre_habitual, dias_hasta_vencimiento, observaciones, creado_en, persona_titular:personas(id, nombre, apellido, activo)').order('creado_en', { ascending: false }),
      supabase.from('tarjetas_fisicas').select('id, cuenta_tarjeta_id, persona_id, tipo, nombre_en_tarjeta, alias, ultimos_4_digitos, activo, observaciones, creado_en, persona:personas(id, nombre, apellido, activo)').order('creado_en', { ascending: false }),
    ]);
    if (errorPersonas || errorCuentas || errorTarjetas) { setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información de tarjetas.' }); setCargando(false); return; }
    setPersonas(dataPersonas ?? []); setCuentas((dataCuentas as CuentaTarjeta[]) ?? []); setTarjetas((dataTarjetas as TarjetaFisica[]) ?? []); setCargando(false);
  }

  useEffect(() => { void cargarDatos(); }, []);
  function limpiarCuenta() { setCuentaEditandoId(null); setFormCuenta(estadoInicialCuenta); setErrorCuenta(''); }
  function limpiarTarjeta() { setTarjetaEditandoId(null); setFormTarjeta(estadoInicialTarjeta); setErrorTarjeta(''); }
  function cerrarModalTarjeta() { setModalTarjetaAbierto(false); limpiarTarjeta(); }
  function editarCuenta(c: CuentaTarjeta) { setCuentaEditandoId(c.id); setFormCuenta({ nombre_cuenta: c.nombre_cuenta, banco: c.banco ?? '', marca: c.marca ?? '', persona_titular_id: c.persona_titular_id, color_ui: c.color_ui ?? '', icono_ui: c.icono_ui ?? '', dia_cierre_habitual: c.dia_cierre_habitual?.toString() ?? '', dias_hasta_vencimiento: c.dias_hasta_vencimiento?.toString() ?? '', observaciones: c.observaciones ?? '' }); setErrorCuenta(''); }
  function editarTarjeta(t: TarjetaFisica) { setTarjetaEditandoId(t.id); setFormTarjeta({ cuenta_tarjeta_id: t.cuenta_tarjeta_id, persona_id: t.persona_id, tipo: t.tipo, nombre_en_tarjeta: t.nombre_en_tarjeta ?? '', alias: t.alias ?? '', ultimos_4_digitos: t.ultimos_4_digitos ?? '', observaciones: t.observaciones ?? '' }); setErrorTarjeta(''); setModalTarjetaAbierto(true); }
  function prepararNuevaTarjeta(cuentaId: string) { limpiarTarjeta(); setFormTarjeta((p) => ({ ...p, cuenta_tarjeta_id: cuentaId })); setModalTarjetaAbierto(true); }

  async function guardarCuenta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErrorCuenta(''); setMensaje(null);
    const nombre = formCuenta.nombre_cuenta.trim();
    if (!nombre) return setErrorCuenta('El nombre de cuenta es obligatorio.');
    if (!formCuenta.persona_titular_id) return setErrorCuenta('Debés seleccionar una persona titular.');
    const diaTexto = formCuenta.dia_cierre_habitual.trim();
    const diasVencTexto = formCuenta.dias_hasta_vencimiento.trim();
    const dia = diaTexto ? Number.parseInt(diaTexto, 10) : null;
    const diasVenc = diasVencTexto ? Number.parseInt(diasVencTexto, 10) : null;
    if (!diaTexto || !diasVencTexto) return setErrorCuenta('Para crear una cuenta de tarjeta, debés indicar día de cierre habitual y días hasta vencimiento.');
    if (Number.isNaN(dia) || dia < 1 || dia > 31) return setErrorCuenta('El día de cierre habitual debe estar entre 1 y 31.');
    if (Number.isNaN(diasVenc) || diasVenc < 0 || diasVenc > 45) return setErrorCuenta('Los días hasta vencimiento deben estar entre 0 y 45.');

    setGuardandoCuenta(true);
    const payload = { nombre_cuenta: nombre, banco: formCuenta.banco.trim() || null, marca: formCuenta.marca.trim() || null, persona_titular_id: formCuenta.persona_titular_id, color_ui: formCuenta.color_ui.trim() || null, icono_ui: formCuenta.icono_ui.trim() || null, dia_cierre_habitual: dia, dias_hasta_vencimiento: diasVenc, observaciones: formCuenta.observaciones.trim() || null, actualizado_en: new Date().toISOString() };
    const respuesta = cuentaEditandoId ? await supabase.from('cuentas_tarjeta').update(payload).eq('id', cuentaEditandoId) : await supabase.from('cuentas_tarjeta').insert(payload);
    if (respuesta.error) { setMensaje({ tipo: 'error', texto: 'No se pudo guardar la cuenta de tarjeta.' }); setGuardandoCuenta(false); return; }
    setMensaje({ tipo: 'ok', texto: cuentaEditandoId ? 'Cuenta de tarjeta actualizada.' : 'Cuenta de tarjeta creada.' }); setGuardandoCuenta(false); limpiarCuenta(); await cargarDatos();
  }

  async function guardarTarjeta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErrorTarjeta(''); setMensaje(null);
    if (!formTarjeta.cuenta_tarjeta_id) return setErrorTarjeta('Debés elegir una cuenta de tarjeta.');
    if (!formTarjeta.persona_id) return setErrorTarjeta('Debés elegir una persona asociada.');
    if (!['titular', 'adicional'].includes(formTarjeta.tipo)) return setErrorTarjeta('El tipo de tarjeta no es válido.');
    const ultimos4 = formTarjeta.ultimos_4_digitos.trim();
    if (ultimos4 && !/^\d{4}$/.test(ultimos4)) return setErrorTarjeta('Los últimos 4 dígitos deben tener exactamente 4 números.');

    setGuardandoTarjeta(true);
    const payload = { cuenta_tarjeta_id: formTarjeta.cuenta_tarjeta_id, persona_id: formTarjeta.persona_id, tipo: formTarjeta.tipo, nombre_en_tarjeta: formTarjeta.nombre_en_tarjeta.trim() || null, alias: formTarjeta.alias.trim() || null, ultimos_4_digitos: ultimos4 || null, observaciones: formTarjeta.observaciones.trim() || null, actualizado_en: new Date().toISOString() };
    const respuesta = tarjetaEditandoId ? await supabase.from('tarjetas_fisicas').update(payload).eq('id', tarjetaEditandoId) : await supabase.from('tarjetas_fisicas').insert(payload);
    if (respuesta.error) { setMensaje({ tipo: 'error', texto: 'No se pudo guardar la tarjeta física.' }); setGuardandoTarjeta(false); return; }
    setMensaje({ tipo: 'ok', texto: tarjetaEditandoId ? 'Tarjeta física actualizada.' : 'Tarjeta física creada.' }); setGuardandoTarjeta(false); cerrarModalTarjeta(); await cargarDatos();
  }

  async function cambiarEstadoCuenta(c: CuentaTarjeta, s: boolean) { const { error } = await supabase.from('cuentas_tarjeta').update({ activo: s, actualizado_en: new Date().toISOString() }).eq('id', c.id); if (error) return setMensaje({ tipo: 'error', texto: s ? 'No se pudo reactivar la cuenta.' : 'No se pudo desactivar la cuenta.' }); setMensaje({ tipo: 'ok', texto: s ? 'Cuenta reactivada.' : 'Cuenta desactivada.' }); await cargarDatos(); }
  async function cambiarEstadoTarjeta(t: TarjetaFisica, s: boolean) { const { error } = await supabase.from('tarjetas_fisicas').update({ activo: s, actualizado_en: new Date().toISOString() }).eq('id', t.id); if (error) return setMensaje({ tipo: 'error', texto: s ? 'No se pudo reactivar la tarjeta física.' : 'No se pudo desactivar la tarjeta física.' }); setMensaje({ tipo: 'ok', texto: s ? 'Tarjeta física reactivada.' : 'Tarjeta física desactivada.' }); await cargarDatos(); }

  function cuentaSinConfiguracion(cuenta: CuentaTarjeta) { return cuenta.dia_cierre_habitual === null || cuenta.dias_hasta_vencimiento === null; }

  return <section className="mx-auto max-w-[1440px] space-y-5 px-2 pb-6 md:px-4">
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">SpendWise</p><h1 className="text-2xl font-semibold">Tarjetas</h1><p className="text-sm text-slate-600">Gestioná tus cuentas, tarjetas titulares y adicionales en un solo lugar.</p></header>
    {mensaje && <div className={`rounded-xl border px-4 py-3 text-sm ${mensaje.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{mensaje.texto}</div>}

    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-semibold">{tituloCuenta}</h2><p className="text-xs text-slate-500">Configuración base de estado de cuenta en formato compacto.</p></div>{cuentaEditandoId && <button type="button" onClick={limpiarCuenta} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700">Cancelar edición</button>}</div>
      <form onSubmit={guardarCuenta} className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
        <input value={formCuenta.nombre_cuenta} onChange={(e) => setFormCuenta((p) => ({ ...p, nombre_cuenta: e.target.value }))} placeholder="Nombre de cuenta *" className="xl:col-span-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <input value={formCuenta.banco} onChange={(e) => setFormCuenta((p) => ({ ...p, banco: e.target.value }))} placeholder="Banco" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <input value={formCuenta.marca} onChange={(e) => setFormCuenta((p) => ({ ...p, marca: e.target.value }))} placeholder="Marca" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <select value={formCuenta.persona_titular_id} onChange={(e) => setFormCuenta((p) => ({ ...p, persona_titular_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Persona titular *</option>{personas.map((p) => <option key={p.id} value={p.id}>{nombrePersona(p)}</option>)}</select>
        <label className="space-y-1"><span className="text-xs font-medium text-slate-700">Día cierre habitual *</span><input required inputMode="numeric" value={formCuenta.dia_cierre_habitual} onChange={(e) => setFormCuenta((p) => ({ ...p, dia_cierre_habitual: e.target.value }))} placeholder="Ej: 29" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><span className="block text-[11px] text-slate-500">Día aproximado del mes en que cierra el resumen. Ejemplo: 29.</span></label>
        <label className="space-y-1"><span className="text-xs font-medium text-slate-700">Días hasta vencimiento *</span><input required inputMode="numeric" value={formCuenta.dias_hasta_vencimiento} onChange={(e) => setFormCuenta((p) => ({ ...p, dias_hasta_vencimiento: e.target.value }))} placeholder="Ej: 7" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><span className="block text-[11px] text-slate-500">Cantidad de días entre el cierre y el vencimiento del resumen. Ejemplo: si cierra el 29 y vence el 5 del mes siguiente, son 7 días aproximadamente.</span></label>
        <textarea value={formCuenta.observaciones} onChange={(e) => setFormCuenta((p) => ({ ...p, observaciones: e.target.value }))} rows={1} placeholder="Observaciones" className="md:col-span-2 xl:col-span-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <button disabled={guardandoCuenta} className="md:col-span-2 xl:col-span-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">{guardandoCuenta ? 'Guardando...' : 'Guardar cuenta'}</button>
      </form>
      {errorCuenta && <p className="mt-2 text-sm text-rose-600">{errorCuenta}</p>}
    </div>

    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Board de cuentas registradas</h2>
      {cargando ? <p className="text-sm text-slate-600">Cargando cuentas...</p> : cuentas.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">No hay cuentas de tarjeta registradas.</p> : <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{cuentas.map((cuenta) => { const tarjetasCuenta = tarjetas.filter((x) => x.cuenta_tarjeta_id === cuenta.id); const sinConfiguracion = cuentaSinConfiguracion(cuenta); return <article key={cuenta.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-start justify-between gap-2"><div><h3 className="text-base font-semibold text-slate-900">{cuenta.icono_ui ? `${cuenta.icono_ui} ` : ''}{cuenta.nombre_cuenta}</h3><p className="text-xs text-slate-600">{cuenta.banco ?? '-'} · {cuenta.marca ?? '-'}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cuenta.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{cuenta.activo ? 'Activa' : 'Inactiva'}</span></div><div className="space-y-1 text-xs text-slate-600"><p><span className="font-medium text-slate-700">Titular:</span> {nombrePersona(cuenta.persona_titular)}</p><p><span className="font-medium text-slate-700">Día cierre habitual:</span> {cuenta.dia_cierre_habitual ?? '-'}</p><p><span className="font-medium text-slate-700">Días hasta vencimiento:</span> {cuenta.dias_hasta_vencimiento ?? '-'}</p>{cuenta.observaciones && <p className="rounded-md bg-slate-50 p-2">{cuenta.observaciones}</p>}</div>{sinConfiguracion && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-xs font-semibold text-amber-800">Falta configuración de cierre/vencimiento</p><p className="mt-1 text-xs text-amber-700">Completá estos datos para que SpendWise pueda proyectar pagos automáticamente.</p><button type="button" onClick={() => editarCuenta(cuenta)} className="mt-2 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800">Completar configuración</button></div>}<div className="my-3 flex flex-wrap gap-2"><button type="button" onClick={() => editarCuenta(cuenta)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700">Editar cuenta</button><button type="button" onClick={() => cambiarEstadoCuenta(cuenta, !cuenta.activo)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${cuenta.activo ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}`}>{cuenta.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}</button><button type="button" onClick={() => prepararNuevaTarjeta(cuenta.id)} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Agregar tarjeta física</button></div><div className="space-y-2 border-t border-slate-100 pt-3">{tarjetasCuenta.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">Sin tarjetas físicas asociadas.</p> : tarjetasCuenta.map((tarjeta) => <div key={tarjeta.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{tarjeta.alias || tarjeta.nombre_en_tarjeta || 'Tarjeta sin alias'}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tarjeta.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{tarjeta.activo ? 'Activa' : 'Inactiva'}</span></div><div className="space-y-1 text-xs text-slate-600"><p><span className="font-medium text-slate-700">Persona:</span> {nombrePersona(tarjeta.persona)}</p><p><span className="font-medium text-slate-700">Tipo:</span> {tarjeta.tipo}</p><p><span className="font-medium text-slate-700">Alias:</span> {tarjeta.alias ?? '-'}</p><p><span className="font-medium text-slate-700">Últimos 4:</span> {tarjeta.ultimos_4_digitos ?? '-'}</p></div><div className="mt-2 flex gap-2"><button type="button" onClick={() => editarTarjeta(tarjeta)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700">Editar</button><button type="button" onClick={() => cambiarEstadoTarjeta(tarjeta, !tarjeta.activo)} className={`rounded-lg border px-2 py-1 text-xs ${tarjeta.activo ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}`}>{tarjeta.activo ? 'Desactivar' : 'Reactivar'}</button></div></div>)}</div></article>; })}</div>}
    </div>

    {modalTarjetaAbierto && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 md:items-center md:p-4"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl md:rounded-2xl md:p-5"><div className="mb-3 flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{tituloTarjeta}</h2><p className="text-xs text-slate-500">Asigná la tarjeta a esta cuenta de forma contextual.</p></div><button type="button" onClick={cerrarModalTarjeta} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs">Cerrar</button></div><form onSubmit={guardarTarjeta} className="space-y-3"><select value={formTarjeta.cuenta_tarjeta_id} onChange={(e) => setFormTarjeta((p) => ({ ...p, cuenta_tarjeta_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar cuenta *</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre_cuenta}</option>)}</select><select value={formTarjeta.persona_id} onChange={(e) => setFormTarjeta((p) => ({ ...p, persona_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar persona *</option>{personas.map((p) => <option key={p.id} value={p.id}>{nombrePersona(p)}</option>)}</select><select value={formTarjeta.tipo} onChange={(e) => setFormTarjeta((p) => ({ ...p, tipo: e.target.value as TipoTarjetaFisica }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="titular">Titular</option><option value="adicional">Adicional</option></select><input value={formTarjeta.alias} onChange={(e) => setFormTarjeta((p) => ({ ...p, alias: e.target.value }))} placeholder="Alias" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input value={formTarjeta.nombre_en_tarjeta} onChange={(e) => setFormTarjeta((p) => ({ ...p, nombre_en_tarjeta: e.target.value }))} placeholder="Nombre en tarjeta" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input inputMode="numeric" value={formTarjeta.ultimos_4_digitos} onChange={(e) => setFormTarjeta((p) => ({ ...p, ultimos_4_digitos: e.target.value }))} placeholder="Últimos 4 dígitos" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><textarea value={formTarjeta.observaciones} onChange={(e) => setFormTarjeta((p) => ({ ...p, observaciones: e.target.value }))} rows={2} placeholder="Observaciones" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />{errorTarjeta && <p className="text-sm text-rose-600">{errorTarjeta}</p>}<button disabled={guardandoTarjeta} type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">{guardandoTarjeta ? 'Guardando...' : 'Guardar tarjeta física'}</button></form></div></div>}
  </section>;
}
