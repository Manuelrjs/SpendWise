'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Categoria = {
  id: string;
  nombre: string;
  icono: string | null;
  color: string | null;
  activo: boolean;
  orden: number | null;
  creado_en: string;
  actualizado_en: string;
};

type FormularioCategoria = {
  nombre: string;
  icono: string;
  color: string;
  orden: string;
};

const estadoInicialFormulario: FormularioCategoria = {
  nombre: '',
  icono: '',
  color: '',
  orden: '',
};

function formatearFecha(fechaIso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(fechaIso));
}

export default function Page() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [categoriaEditandoId, setCategoriaEditandoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioCategoria>(estadoInicialFormulario);
  const [errorFormulario, setErrorFormulario] = useState('');
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const tituloFormulario = useMemo(
    () => (categoriaEditandoId ? 'Editar categoría' : 'Nueva categoría'),
    [categoriaEditandoId],
  );

  async function cargarCategorias() {
    setCargando(true);
    setMensaje(null);

    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre, icono, color, activo, orden, creado_en, actualizado_en')
      .order('orden', { ascending: true, nullsFirst: false })
      .order('creado_en', { ascending: false });

    if (error) {
      setMensaje({ tipo: 'error', texto: 'No se pudieron cargar las categorías.' });
      setCargando(false);
      return;
    }

    setCategorias(data ?? []);
    setCargando(false);
  }

  useEffect(() => {
    void cargarCategorias();
  }, []);

  function limpiarFormulario() {
    setCategoriaEditandoId(null);
    setFormulario(estadoInicialFormulario);
    setErrorFormulario('');
  }

  function cargarFormularioParaEditar(categoria: Categoria) {
    setCategoriaEditandoId(categoria.id);
    setFormulario({
      nombre: categoria.nombre,
      icono: categoria.icono ?? '',
      color: categoria.color ?? '',
      orden: categoria.orden?.toString() ?? '',
    });
    setErrorFormulario('');
    setMensaje(null);
  }

  async function guardarCategoria(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErrorFormulario('');
    setMensaje(null);

    const nombreLimpio = formulario.nombre.trim();
    if (!nombreLimpio) {
      setErrorFormulario('El nombre es obligatorio.');
      return;
    }

    const ordenLimpio = formulario.orden.trim();
    const ordenNumero = ordenLimpio ? Number.parseInt(ordenLimpio, 10) : null;

    if (ordenLimpio && Number.isNaN(ordenNumero)) {
      setErrorFormulario('El orden debe ser un número válido.');
      return;
    }

    setGuardando(true);

    const payload = {
      nombre: nombreLimpio,
      icono: formulario.icono.trim() || null,
      color: formulario.color.trim() || null,
      orden: ordenNumero,
      actualizado_en: new Date().toISOString(),
    };

    const respuesta = categoriaEditandoId
      ? await supabase.from('categorias').update(payload).eq('id', categoriaEditandoId)
      : await supabase.from('categorias').insert(payload);

    if (respuesta.error) {
      setMensaje({ tipo: 'error', texto: 'No se pudo guardar la categoría.' });
      setGuardando(false);
      return;
    }

    setMensaje({ tipo: 'ok', texto: categoriaEditandoId ? 'Categoría actualizada con éxito.' : 'Categoría creada con éxito.' });
    setGuardando(false);
    limpiarFormulario();
    await cargarCategorias();
  }

  async function cambiarEstadoCategoria(categoria: Categoria, proximoEstado: boolean) {
    setMensaje(null);

    const { error } = await supabase
      .from('categorias')
      .update({ activo: proximoEstado, actualizado_en: new Date().toISOString() })
      .eq('id', categoria.id);

    if (error) {
      setMensaje({
        tipo: 'error',
        texto: proximoEstado ? 'No se pudo reactivar la categoría.' : 'No se pudo desactivar la categoría.',
      });
      return;
    }

    setMensaje({
      tipo: 'ok',
      texto: proximoEstado ? `Categoría ${categoria.nombre} reactivada.` : `Categoría ${categoria.nombre} desactivada.`,
    });
    await cargarCategorias();
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Configuración · Categorías</h1>
        <p className="text-sm text-slate-600">Administrá las categorías disponibles en SpendWise.</p>
      </header>

      {mensaje && <div className={`rounded-xl border px-4 py-3 text-sm ${mensaje.tipo === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{mensaje.texto}</div>}

      <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{tituloFormulario}</h2>
            {categoriaEditandoId && (
              <button type="button" onClick={limpiarFormulario} className="text-sm font-medium text-slate-500 hover:text-slate-700">Cancelar</button>
            )}
          </div>

          <form onSubmit={guardarCategoria} className="space-y-3">
            <div><label htmlFor="nombre" className="mb-1 block text-sm font-medium text-slate-700">Nombre *</label><input id="nombre" value={formulario.nombre} onChange={(e) => setFormulario((p) => ({ ...p, nombre: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring" placeholder="Ej: Supermercado" /></div>
            <div><label htmlFor="icono" className="mb-1 block text-sm font-medium text-slate-700">Ícono</label><input id="icono" value={formulario.icono} onChange={(e) => setFormulario((p) => ({ ...p, icono: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring" placeholder="Ej: 🛒 o shopping-cart" /></div>
            <div><label htmlFor="color" className="mb-1 block text-sm font-medium text-slate-700">Color</label><input id="color" value={formulario.color} onChange={(e) => setFormulario((p) => ({ ...p, color: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring" placeholder="Ej: #10b981 o bg-emerald-500" /></div>
            <div><label htmlFor="orden" className="mb-1 block text-sm font-medium text-slate-700">Orden</label><input id="orden" inputMode="numeric" value={formulario.orden} onChange={(e) => setFormulario((p) => ({ ...p, orden: e.target.value }))} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring" placeholder="Ej: 1" /></div>

            {errorFormulario && <p className="text-sm text-rose-600">{errorFormulario}</p>}
            <button type="submit" disabled={guardando} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70">{guardando ? 'Guardando...' : categoriaEditandoId ? 'Guardar cambios' : 'Agregar categoría'}</button>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Categorías registradas</h2>
          {cargando ? <p className="text-sm text-slate-600">Cargando categorías...</p> : categorias.length === 0 ? <p className="text-sm text-slate-600">Todavía no hay categorías registradas.</p> : <div className="space-y-3">{categorias.map((categoria) => <article key={categoria.id} className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{categoria.icono ? `${categoria.icono} ` : ''}{categoria.nombre}</h3><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${categoria.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{categoria.activo ? 'Activo' : 'Inactivo'}</span></div><p className="text-sm text-slate-600">Color: {categoria.color ?? '-'}</p><p className="text-sm text-slate-600">Orden: {categoria.orden ?? '-'}</p><p className="text-sm text-slate-500">Creado: {formatearFecha(categoria.creado_en)}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => cargarFormularioParaEditar(categoria)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100">Editar</button><button type="button" onClick={() => cambiarEstadoCategoria(categoria, !categoria.activo)} className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium ${categoria.activo ? 'border-rose-200 text-rose-600 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{categoria.activo ? 'Desactivar' : 'Reactivar'}</button></div></article>)}</div>}
        </div>
      </div>
    </section>
  );
}
