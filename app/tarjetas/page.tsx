'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Persona = {
  id: string;
  nombre: string;
  apellido: string | null;
  activo: boolean;
};

type CuentaTarjeta = {
  id: string;
  nombre_cuenta: string;
  banco: string | null;
  marca: string | null;
  persona_titular_id: string;
  activo: boolean;
  color_ui: string | null;
  icono_ui: string | null;
  dia_cierre_habitual: number | null;
  dias_hasta_vencimiento: number | null;
  observaciones: string | null;
  creado_en: string;
  persona_titular: Persona | null;
};

type TipoTarjetaFisica = 'titular' | 'adicional';

type TarjetaFisica = {
  id: string;
  cuenta_tarjeta_id: string;
  persona_id: string;
  tipo: TipoTarjetaFisica;
  nombre_en_tarjeta: string | null;
  alias: string | null;
  ultimos_4_digitos: string | null;
  activo: boolean;
  observaciones: string | null;
  creado_en: string;
  persona: Persona | null;
};

type FormularioCuenta = {
  nombre_cuenta: string;
  banco: string;
  marca: string;
  persona_titular_id: string;
  color_ui: string;
  icono_ui: string;
  dia_cierre_habitual: string;
  dias_hasta_vencimiento: string;
  observaciones: string;
};

type FormularioTarjeta = {
  cuenta_tarjeta_id: string;
  persona_id: string;
  tipo: TipoTarjetaFisica;
  nombre_en_tarjeta: string;
  alias: string;
  ultimos_4_digitos: string;
  observaciones: string;
};

const estadoInicialCuenta: FormularioCuenta = {
  nombre_cuenta: '', banco: '', marca: '', persona_titular_id: '', color_ui: '', icono_ui: '', dia_cierre_habitual: '', dias_hasta_vencimiento: '', observaciones: '',
};

const estadoInicialTarjeta: FormularioTarjeta = {
  cuenta_tarjeta_id: '', persona_id: '', tipo: 'titular', nombre_en_tarjeta: '', alias: '', ultimos_4_digitos: '', observaciones: '',
};

function nombrePersona(persona: Persona | null | undefined) {
  if (!persona) return 'Sin titular';
  return `${persona.nombre}${persona.apellido ? ` ${persona.apellido}` : ''}`;
}

export default function Page() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cuentas, setCuentas] = useState<CuentaTarjeta[]>([]);
  const [tarjetas, setTarjetas] = useState<TarjetaFisica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [guardandoTarjeta, setGuardandoTarjeta] = useState(false);
  const [cuentaEditandoId, setCuentaEditandoId] = useState<string | null>(null);
  const [tarjetaEditandoId, setTarjetaEditandoId] = useState<string | null>(null);
  const [formCuenta, setFormCuenta] = useState<FormularioCuenta>(estadoInicialCuenta);
  const [formTarjeta, setFormTarjeta] = useState<FormularioTarjeta>(estadoInicialTarjeta);
  const [errorCuenta, setErrorCuenta] = useState('');
  const [errorTarjeta, setErrorTarjeta] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const tituloCuenta = useMemo(() => (cuentaEditandoId ? 'Editar cuenta de tarjeta' : 'Nueva cuenta de tarjeta'), [cuentaEditandoId]);
  const tituloTarjeta = useMemo(() => (tarjetaEditandoId ? 'Editar tarjeta física' : 'Nueva tarjeta física'), [tarjetaEditandoId]);

  async function cargarDatos() {
    setCargando(true);
    setMensaje(null);

    const [{ data: dataPersonas, error: errorPersonas }, { data: dataCuentas, error: errorCuentas }, { data: dataTarjetas, error: errorTarjetas }] = await Promise.all([
      supabase.from('personas').select('id, nombre, apellido, activo').order('nombre', { ascending: true }),
      supabase.from('cuentas_tarjeta').select('id, nombre_cuenta, banco, marca, persona_titular_id, activo, color_ui, icono_ui, dia_cierre_habitual, dias_hasta_vencimiento, observaciones, creado_en, persona_titular:personas(id, nombre, apellido, activo)').order('creado_en', { ascending: false }),
      supabase.from('tarjetas_fisicas').select('id, cuenta_tarjeta_id, persona_id, tipo, nombre_en_tarjeta, alias, ultimos_4_digitos, activo, observaciones, creado_en, persona:personas(id, nombre, apellido, activo)').order('creado_en', { ascending: false }),
    ]);

    if (errorPersonas || errorCuentas || errorTarjetas) {
      setMensaje({ tipo: 'error', texto: 'No se pudo cargar la información de tarjetas.' });
      setCargando(false);
      return;
    }

    setPersonas(dataPersonas ?? []);
    setCuentas((dataCuentas as CuentaTarjeta[]) ?? []);
    setTarjetas((dataTarjetas as TarjetaFisica[]) ?? []);
    setCargando(false);
  }

  useEffect(() => { void cargarDatos(); }, []);

  function limpiarCuenta() { setCuentaEditandoId(null); setFormCuenta(estadoInicialCuenta); setErrorCuenta(''); }
  function limpiarTarjeta() { setTarjetaEditandoId(null); setFormTarjeta(estadoInicialTarjeta); setErrorTarjeta(''); }

  function editarCuenta(cuenta: CuentaTarjeta) {
    setCuentaEditandoId(cuenta.id);
    setFormCuenta({
      nombre_cuenta: cuenta.nombre_cuenta,
      banco: cuenta.banco ?? '',
      marca: cuenta.marca ?? '',
      persona_titular_id: cuenta.persona_titular_id,
      color_ui: cuenta.color_ui ?? '',
      icono_ui: cuenta.icono_ui ?? '',
      dia_cierre_habitual: cuenta.dia_cierre_habitual?.toString() ?? '',
      dias_hasta_vencimiento: cuenta.dias_hasta_vencimiento?.toString() ?? '',
      observaciones: cuenta.observaciones ?? '',
    });
    setErrorCuenta('');
  }

  function editarTarjeta(tarjeta: TarjetaFisica) {
    setTarjetaEditandoId(tarjeta.id);
    setFormTarjeta({
      cuenta_tarjeta_id: tarjeta.cuenta_tarjeta_id,
      persona_id: tarjeta.persona_id,
      tipo: tarjeta.tipo,
      nombre_en_tarjeta: tarjeta.nombre_en_tarjeta ?? '',
      alias: tarjeta.alias ?? '',
      ultimos_4_digitos: tarjeta.ultimos_4_digitos ?? '',
      observaciones: tarjeta.observaciones ?? '',
    });
    setErrorTarjeta('');
  }

  function prepararNuevaTarjeta(cuentaId: string) {
    limpiarTarjeta();
    setFormTarjeta((previo) => ({ ...previo, cuenta_tarjeta_id: cuentaId }));
  }

  async function guardarCuenta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorCuenta('');
    setMensaje(null);

    const nombre = formCuenta.nombre_cuenta.trim();
    if (!nombre) return setErrorCuenta('El nombre de cuenta es obligatorio.');
    if (!formCuenta.persona_titular_id) return setErrorCuenta('Debés seleccionar una persona titular.');

    const diaTexto = formCuenta.dia_cierre_habitual.trim();
    const diasVencTexto = formCuenta.dias_hasta_vencimiento.trim();
    const dia = diaTexto ? Number.parseInt(diaTexto, 10) : null;
    const diasVenc = diasVencTexto ? Number.parseInt(diasVencTexto, 10) : null;

    if (diaTexto && (Number.isNaN(dia) || dia < 1 || dia > 31)) return setErrorCuenta('El día de cierre habitual debe estar entre 1 y 31.');
    if (diasVencTexto && (Number.isNaN(diasVenc) || diasVenc < 0)) return setErrorCuenta('Los días hasta vencimiento deben ser mayor o igual a 0.');

    setGuardandoCuenta(true);
    const payload = {
      nombre_cuenta: nombre,
      banco: formCuenta.banco.trim() || null,
      marca: formCuenta.marca.trim() || null,
      persona_titular_id: formCuenta.persona_titular_id,
      color_ui: formCuenta.color_ui.trim() || null,
      icono_ui: formCuenta.icono_ui.trim() || null,
      dia_cierre_habitual: dia,
      dias_hasta_vencimiento: diasVenc,
      observaciones: formCuenta.observaciones.trim() || null,
      actualizado_en: new Date().toISOString(),
    };

    const respuesta = cuentaEditandoId
      ? await supabase.from('cuentas_tarjeta').update(payload).eq('id', cuentaEditandoId)
      : await supabase.from('cuentas_tarjeta').insert(payload);

    if (respuesta.error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar la cuenta de tarjeta.' });
      setGuardandoCuenta(false);
      return;
    }

    setMensaje({ tipo: 'ok', texto: cuentaEditandoId ? 'Cuenta de tarjeta actualizada.' : 'Cuenta de tarjeta creada.' });
    setGuardandoCuenta(false);
    limpiarCuenta();
    await cargarDatos();
  }

  async function guardarTarjeta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorTarjeta('');
    setMensaje(null);
    if (!formTarjeta.cuenta_tarjeta_id) return setErrorTarjeta('Debés elegir una cuenta de tarjeta.');
    if (!formTarjeta.persona_id) return setErrorTarjeta('Debés elegir una persona asociada.');
    if (!['titular', 'adicional'].includes(formTarjeta.tipo)) return setErrorTarjeta('El tipo de tarjeta no es válido.');
    const ultimos4 = formTarjeta.ultimos_4_digitos.trim();
    if (ultimos4 && !/^\d{4}$/.test(ultimos4)) return setErrorTarjeta('Los últimos 4 dígitos deben tener exactamente 4 números.');

    setGuardandoTarjeta(true);
    const payload = {
      cuenta_tarjeta_id: formTarjeta.cuenta_tarjeta_id,
      persona_id: formTarjeta.persona_id,
      tipo: formTarjeta.tipo,
      nombre_en_tarjeta: formTarjeta.nombre_en_tarjeta.trim() || null,
      alias: formTarjeta.alias.trim() || null,
      ultimos_4_digitos: ultimos4 || null,
      observaciones: formTarjeta.observaciones.trim() || null,
      actualizado_en: new Date().toISOString(),
    };

    const respuesta = tarjetaEditandoId
      ? await supabase.from('tarjetas_fisicas').update(payload).eq('id', tarjetaEditandoId)
      : await supabase.from('tarjetas_fisicas').insert(payload);

    if (respuesta.error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar la tarjeta física.' });
      setGuardandoTarjeta(false);
      return;
    }

    setMensaje({ tipo: 'ok', texto: tarjetaEditandoId ? 'Tarjeta física actualizada.' : 'Tarjeta física creada.' });
    setGuardandoTarjeta(false);
    limpiarTarjeta();
    await cargarDatos();
  }

  async function cambiarEstadoCuenta(cuenta: CuentaTarjeta, proximoEstado: boolean) {
    const { error } = await supabase.from('cuentas_tarjeta').update({ activo: proximoEstado, actualizado_en: new Date().toISOString() }).eq('id', cuenta.id);
    if (error) return setMensaje({ tipo: 'error', texto: proximoEstado ? 'No se pudo reactivar la cuenta.' : 'No se pudo desactivar la cuenta.' });
    setMensaje({ tipo: 'ok', texto: proximoEstado ? 'Cuenta reactivada.' : 'Cuenta desactivada.' });
    await cargarDatos();
  }

  async function cambiarEstadoTarjeta(tarjeta: TarjetaFisica, proximoEstado: boolean) {
    const { error } = await supabase.from('tarjetas_fisicas').update({ activo: proximoEstado, actualizado_en: new Date().toISOString() }).eq('id', tarjeta.id);
    if (error) return setMensaje({ tipo: 'error', texto: proximoEstado ? 'No se pudo reactivar la tarjeta física.' : 'No se pudo desactivar la tarjeta física.' });
    setMensaje({ tipo: 'ok', texto: proximoEstado ? 'Tarjeta física reactivada.' : 'Tarjeta física desactivada.' });
    await cargarDatos();
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="space-y-2"><h1 className="text-2xl font-semibold">Tarjetas</h1><p className="text-sm text-slate-600">Administrá cuentas de tarjeta y plásticos titulares/adicionales.</p></header>
      {mensaje && <div className={`rounded-xl border px-4 py-3 text-sm ${mensaje.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{mensaje.texto}</div>}
      <div className="grid gap-6 xl:grid-cols-[380px,380px,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{tituloCuenta}</h2>{cuentaEditandoId && <button onClick={limpiarCuenta} type="button" className="text-sm text-slate-500">Cancelar</button>}</div><form onSubmit={guardarCuenta} className="space-y-3">{['nombre_cuenta','banco','marca','color_ui','icono_ui'].map((campo) => <input key={campo} value={formCuenta[campo as keyof FormularioCuenta] as string} onChange={(e) => setFormCuenta((p) => ({...p,[campo]: e.target.value}))} placeholder={campo === 'nombre_cuenta' ? 'Nombre de cuenta *' : campo} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />)}<select value={formCuenta.persona_titular_id} onChange={(e) => setFormCuenta((p) => ({ ...p, persona_titular_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar persona titular *</option>{personas.map((persona) => <option value={persona.id} key={persona.id}>{nombrePersona(persona)}</option>)}</select><div className="grid grid-cols-2 gap-2"><input inputMode="numeric" value={formCuenta.dia_cierre_habitual} onChange={(e) => setFormCuenta((p) => ({ ...p, dia_cierre_habitual: e.target.value }))} placeholder="Día cierre (1-31)" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input inputMode="numeric" value={formCuenta.dias_hasta_vencimiento} onChange={(e) => setFormCuenta((p) => ({ ...p, dias_hasta_vencimiento: e.target.value }))} placeholder="Días a venc." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></div><textarea value={formCuenta.observaciones} onChange={(e) => setFormCuenta((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Observaciones" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={3} />{errorCuenta && <p className="text-sm text-rose-600">{errorCuenta}</p>}<button disabled={guardandoCuenta} type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">{guardandoCuenta ? 'Guardando...' : 'Guardar cuenta'}</button></form></div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{tituloTarjeta}</h2>{tarjetaEditandoId && <button onClick={limpiarTarjeta} type="button" className="text-sm text-slate-500">Cancelar</button>}</div><form onSubmit={guardarTarjeta} className="space-y-3"><select value={formTarjeta.cuenta_tarjeta_id} onChange={(e) => setFormTarjeta((p) => ({ ...p, cuenta_tarjeta_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar cuenta *</option>{cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre_cuenta}</option>)}</select><select value={formTarjeta.persona_id} onChange={(e) => setFormTarjeta((p) => ({ ...p, persona_id: e.target.value }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="">Seleccionar persona *</option>{personas.map((persona) => <option key={persona.id} value={persona.id}>{nombrePersona(persona)}</option>)}</select><select value={formTarjeta.tipo} onChange={(e) => setFormTarjeta((p) => ({ ...p, tipo: e.target.value as TipoTarjetaFisica }))} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="titular">titular</option><option value="adicional">adicional</option></select><input value={formTarjeta.nombre_en_tarjeta} onChange={(e) => setFormTarjeta((p) => ({ ...p, nombre_en_tarjeta: e.target.value }))} placeholder="Nombre en tarjeta" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input value={formTarjeta.alias} onChange={(e) => setFormTarjeta((p) => ({ ...p, alias: e.target.value }))} placeholder="Alias" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><input inputMode="numeric" value={formTarjeta.ultimos_4_digitos} onChange={(e) => setFormTarjeta((p) => ({ ...p, ultimos_4_digitos: e.target.value }))} placeholder="Últimos 4 dígitos" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /><textarea value={formTarjeta.observaciones} onChange={(e) => setFormTarjeta((p) => ({ ...p, observaciones: e.target.value }))} placeholder="Observaciones" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" rows={3} />{errorTarjeta && <p className="text-sm text-rose-600">{errorTarjeta}</p>}<button disabled={guardandoTarjeta} type="submit" className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white">{guardandoTarjeta ? 'Guardando...' : 'Guardar tarjeta física'}</button></form></div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><h2 className="mb-4 text-lg font-semibold">Cuentas registradas</h2>{cargando ? <p className="text-sm text-slate-600">Cargando cuentas...</p> : cuentas.length === 0 ? <p className="text-sm text-slate-600">No hay cuentas de tarjeta registradas.</p> : <div className="space-y-4">{cuentas.map((cuenta) => { const tarjetasCuenta = tarjetas.filter((tarjeta) => tarjeta.cuenta_tarjeta_id === cuenta.id); return <article key={cuenta.id} className="rounded-2xl border border-slate-200 p-4"><div className="mb-3 flex items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">{cuenta.icono_ui ? `${cuenta.icono_ui} ` : ''}{cuenta.nombre_cuenta}</h3><p className="text-sm text-slate-600">{cuenta.banco ?? '-'} · {cuenta.marca ?? '-'}</p><p className="text-sm text-slate-600">Titular: {nombrePersona(cuenta.persona_titular)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cuenta.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>{cuenta.activo ? 'Activa' : 'Inactiva'}</span></div><div className="mb-3 grid grid-cols-2 gap-2 text-sm text-slate-600"><p>Cierre habitual: {cuenta.dia_cierre_habitual ?? '-'}</p><p>Días a vencimiento: {cuenta.dias_hasta_vencimiento ?? '-'}</p></div><div className="mb-3 flex gap-2"><button type="button" onClick={() => editarCuenta(cuenta)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Editar cuenta</button><button type="button" onClick={() => cambiarEstadoCuenta(cuenta, !cuenta.activo)} className={`rounded-lg border px-3 py-2 text-xs font-medium ${cuenta.activo ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}`}>{cuenta.activo ? 'Desactivar cuenta' : 'Reactivar cuenta'}</button><button type="button" onClick={() => prepararNuevaTarjeta(cuenta.id)} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700">Agregar tarjeta física</button></div><div className="space-y-2">{tarjetasCuenta.length === 0 ? <p className="text-sm text-slate-500">Sin tarjetas físicas asociadas.</p> : tarjetasCuenta.map((tarjeta) => <div key={tarjeta.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="mb-1 flex items-center justify-between"><p className="text-sm font-medium text-slate-900">{tarjeta.alias || tarjeta.nombre_en_tarjeta || 'Tarjeta sin alias'}</p><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tarjeta.tipo === 'titular' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>{tarjeta.tipo}</span></div><p className="text-xs text-slate-600">Persona: {nombrePersona(tarjeta.persona)} · Últimos 4: {tarjeta.ultimos_4_digitos ?? '-'}</p><p className="text-xs text-slate-500">Estado: {tarjeta.activo ? 'Activa' : 'Inactiva'}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => editarTarjeta(tarjeta)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700">Editar</button><button type="button" onClick={() => cambiarEstadoTarjeta(tarjeta, !tarjeta.activo)} className={`rounded-lg border px-2.5 py-1.5 text-xs ${tarjeta.activo ? 'border-rose-200 text-rose-700' : 'border-emerald-200 text-emerald-700'}`}>{tarjeta.activo ? 'Desactivar' : 'Reactivar'}</button></div></div>)}</div></article>; })}</div>}</div>
      </div>
    </section>
  );
}
