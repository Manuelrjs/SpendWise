'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { obtenerPerfilActivo } from '@/lib/auth/grupo-activo';

type Persona = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  relacion_familiar: string | null;
  activo: boolean;
  creado_en: string;
  actualizado_en: string;
};

type FormularioPersona = {
  nombre: string;
  apellido: string;
  email: string;
  relacion_familiar: string;
};

const estadoInicialFormulario: FormularioPersona = {
  nombre: '',
  apellido: '',
  email: '',
  relacion_familiar: '',
};

function formatearFecha(fechaIso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fechaIso));
}

export default function Page() {
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [personaEditandoId, setPersonaEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioPersona>(estadoInicialFormulario);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const tituloFormulario = useMemo(
    () => (personaEditandoId ? 'Editar persona' : 'Nueva persona'),
    [personaEditandoId],
  );

  async function cargarPersonas() {
    if (!grupoId) return;
    setCargando(true);
    setMensaje(null);

    const { data, error } = await supabase
      .from('personas')
      .select('id, nombre, apellido, email, relacion_familiar, activo, creado_en, actualizado_en')
      .eq('grupo_id', grupoId)
      .order('creado_en', { ascending: false });

    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar las personas.' });
      setCargando(false);
      return;
    }

    setPersonas(data ?? []);
    if (process.env.NODE_ENV !== "production") console.debug("[debug] /personas", { pantalla: "/personas", email: usuarioEmail, grupo_id: grupoId, registros: (data ?? []).length });
    setCargando(false);
  }

  useEffect(() => {
    (async () => {
      const perfil = await obtenerPerfilActivo();
      setGrupoId(perfil.grupo_id);
      const { data: authData } = await supabase.auth.getUser();
      setUsuarioEmail(authData.user?.email ?? null);
    })();
  }, [grupoId]);

  useEffect(() => {
    if (!grupoId) return;
    void cargarPersonas();
  }, []);

  function limpiarFormulario() {
    setPersonaEditandoId(null);
    setFormulario(estadoInicialFormulario);
    setErrorFormulario('');
  }

  function cargarFormularioParaEditar(persona: Persona) {
    setPersonaEditandoId(persona.id);
    setFormulario({
      nombre: persona.nombre,
      apellido: persona.apellido ?? '',
      email: persona.email ?? '',
      relacion_familiar: persona.relacion_familiar ?? '',
    });
    setErrorFormulario('');
    setMensaje(null);
  }

  async function guardarPersona(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario('');
    setMensaje(null);

    const nombreLimpio = formulario.nombre.trim();

    if (!nombreLimpio) {
      setErrorFormulario('El nombre es obligatorio.');
      return;
    }

    setGuardando(true);

    const payload = {
      nombre: nombreLimpio,
      apellido: formulario.apellido.trim() || null,
      email: formulario.email.trim() || null,
      relacion_familiar: formulario.relacion_familiar.trim() || null,
      actualizado_en: new Date().toISOString(),
    };

    const respuesta = personaEditandoId
      ? await supabase.from('personas').update(payload).eq('id', personaEditandoId).eq('grupo_id', grupoId)
      : await supabase.from('personas').insert({ ...payload, grupo_id: grupoId });

    if (respuesta.error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar la persona.' });
      setGuardando(false);
      return;
    }

    setMensaje({
      tipo: 'ok',
      texto: personaEditandoId ? 'Persona actualizada con éxito.' : 'Persona creada con éxito.',
    });
    setGuardando(false);
    limpiarFormulario();
    await cargarPersonas();
  }

  async function cambiarEstadoPersona(persona: Persona, proximoEstado: boolean) {
    setMensaje(null);

    const { error } = await supabase
      .from('personas')
      .update({ activo: proximoEstado, actualizado_en: new Date().toISOString() })
      .eq('id', persona.id).eq('grupo_id', grupoId);

    if (error) {
      setMensaje({
        tipo: 'error',
        texto: proximoEstado
          ? 'No se pudo reactivar la persona.'
          : 'No se pudo desactivar la persona.',
      });
      return;
    }

    setMensaje({
      tipo: 'ok',
      texto: proximoEstado
        ? `Persona ${persona.nombre} reactivada.`
        : `Persona ${persona.nombre} desactivada.`,
    });
    await cargarPersonas();
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Configuración · Personas</h1>
        <p className="text-sm text-slate-600">Administrá las personas que pueden registrar gastos.</p>
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

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{tituloFormulario}</h2>
            {personaEditandoId && (
              <button
                type="button"
                onClick={limpiarFormulario}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Cancelar
              </button>
            )}
          </div>

          <form onSubmit={guardarPersona} className="space-y-3">
            <div>
              <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-slate-700">
                Nombre *
              </label>
              <input
                id="nombre"
                value={formulario.nombre}
                onChange={(event) => setFormulario((previo) => ({ ...previo, nombre: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
                placeholder="Ej: Manuel"
              />
            </div>

            <div>
              <label htmlFor="apellido" className="mb-1 block text-sm font-medium text-slate-700">
                Apellido
              </label>
              <input
                id="apellido"
                value={formulario.apellido}
                onChange={(event) => setFormulario((previo) => ({ ...previo, apellido: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
                placeholder="Ej: Pérez"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formulario.email}
                onChange={(event) => setFormulario((previo) => ({ ...previo, email: event.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
                placeholder="Ej: persona@email.com"
              />
            </div>

            <div>
              <label htmlFor="relacion_familiar" className="mb-1 block text-sm font-medium text-slate-700">
                Relación familiar
              </label>
              <input
                id="relacion_familiar"
                value={formulario.relacion_familiar}
                onChange={(event) =>
                  setFormulario((previo) => ({
                    ...previo,
                    relacion_familiar: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring"
                placeholder="Ej: Titular"
              />
            </div>

            {errorFormulario && <p className="text-sm text-rose-600">{errorFormulario}</p>}

            <button
              type="submit"
              disabled={guardando}
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {guardando ? 'Guardando...' : personaEditandoId ? 'Guardar cambios' : 'Agregar persona'}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Personas registradas</h2>

          {cargando ? (
            <p className="text-sm text-slate-600">Cargando personas...</p>
          ) : personas.length === 0 ? (
            <p className="text-sm text-slate-600">Todavía no hay personas registradas.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Nombre</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Relación</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Creado</th>
                      <th className="px-3 py-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personas.map((persona) => (
                      <tr key={persona.id} className="border-t border-slate-100">
                        <td className="px-3 py-3 font-medium text-slate-900">
                          {persona.nombre} {persona.apellido ?? ''}
                        </td>
                        <td className="px-3 py-3 text-slate-600">{persona.email ?? '-'}</td>
                        <td className="px-3 py-3 text-slate-600">{persona.relacion_familiar ?? '-'}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                              persona.activo
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {persona.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{formatearFecha(persona.creado_en)}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => cargarFormularioParaEditar(persona)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => cambiarEstadoPersona(persona, !persona.activo)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                                persona.activo
                                  ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {persona.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {personas.map((persona) => (
                  <article key={persona.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">
                        {persona.nombre} {persona.apellido ?? ''}
                      </h3>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          persona.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {persona.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">Email: {persona.email ?? '-'}</p>
                    <p className="text-sm text-slate-600">Relación: {persona.relacion_familiar ?? '-'}</p>
                    <p className="text-sm text-slate-500">Creado: {formatearFecha(persona.creado_en)}</p>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => cargarFormularioParaEditar(persona)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => cambiarEstadoPersona(persona, !persona.activo)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                          persona.activo
                            ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        {persona.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
