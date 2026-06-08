'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type IconoNombre = 'inicio' | 'nuevo' | 'gastos' | 'reportes' | 'tarjetas' | 'calendario' | 'flujo' | 'cuotas' | 'grupo' | 'personas' | 'categorias' | 'pagos' | 'ajustes';

type Enlace = { href: string; etiqueta: string; icono: IconoNombre };
type GrupoEnlaces = { titulo: string; enlaces: Enlace[] };

const gruposEnlaces: GrupoEnlaces[] = [
  { titulo: 'Planificación', enlaces: [
    { href: '/', etiqueta: 'Dashboard', icono: 'inicio' },
    { href: '/gastos/nuevo', etiqueta: 'Nuevo gasto', icono: 'nuevo' },
    { href: '/gastos', etiqueta: 'Gastos', icono: 'gastos' },
    { href: '/flujo', etiqueta: 'Flujo mensual', icono: 'flujo' },
    { href: '/reportes', etiqueta: 'Reportes', icono: 'reportes' },
  ] },
  { titulo: 'Tarjetas', enlaces: [
    { href: '/tarjetas', etiqueta: 'Tarjetas', icono: 'tarjetas' },
    { href: '/calendario', etiqueta: 'Calendario', icono: 'calendario' },
    { href: '/cuotas-iniciales', etiqueta: 'Cuotas iniciales', icono: 'cuotas' },
  ] },
  { titulo: 'Configuración', enlaces: [
    { href: '/configuracion/grupo', etiqueta: 'Grupo', icono: 'grupo' },
    { href: '/configuracion/personas', etiqueta: 'Personas', icono: 'personas' },
    { href: '/configuracion/categorias', etiqueta: 'Categorías', icono: 'categorias' },
    { href: '/configuracion/medios-pago', etiqueta: 'Medios de pago', icono: 'pagos' },
    { href: '/configuracion/mantenimiento', etiqueta: 'Mantenimiento', icono: 'ajustes' },
  ] },
];

const enlacesMoviles = [gruposEnlaces[0].enlaces[0], gruposEnlaces[0].enlaces[1], gruposEnlaces[0].enlaces[2], gruposEnlaces[0].enlaces[3], gruposEnlaces[2].enlaces[0]];

function Icono({ nombre }: { nombre: IconoNombre }) {
  const trazos: Record<IconoNombre, React.ReactNode> = {
    inicio: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/></>,
    nuevo: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    gastos: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h4"/></>,
    reportes: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    tarjetas: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
    calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></>,
    flujo: <><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></>,
    cuotas: <><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3"/></>,
    grupo: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3 0 5 1.7 5 5"/></>,
    personas: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></>,
    categorias: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></>,
    pagos: <><path d="M3 7h18v12H3zM3 11h18M7 15h3"/></>,
    ajustes: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-none stroke-current stroke-[1.8] stroke-linecap-round stroke-linejoin-round">{trazos[nombre]}</svg>;
}

function LogoMarca() {
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-900/20"><Icono nombre="flujo" /></span>;
}

export function NavegacionPrincipal() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === '/login' || pathname === '/registro' || pathname === '/aceptar-invitacion') return null;

  const estaActivo = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  const cerrarSesion = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  return <>
    <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-r md:border-slate-200/80 md:bg-white/95 md:shadow-[8px_0_30px_rgba(15,23,42,0.03)] md:backdrop-blur">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center gap-3"><LogoMarca /><div><p className="font-bold tracking-tight text-slate-950">SpendFlow Planner</p><p className="text-xs text-slate-500">Control y flujo futuro</p></div></div>
        <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">Tu planificación</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">Anticipá tu flujo mensual</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Gastos, tarjetas y cuotas en un solo lugar.</p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {gruposEnlaces.map((grupo) => <div key={grupo.titulo} className="mb-5">
          <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{grupo.titulo}</p>
          <div className="space-y-1">{grupo.enlaces.map((enlace) => <Link key={enlace.href} href={enlace.href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${estaActivo(enlace.href) ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/15' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}><Icono nombre={enlace.icono} /><span>{enlace.etiqueta}</span></Link>)}</div>
        </div>)}
      </nav>
      <div className="border-t border-slate-100 p-3"><button onClick={cerrarSesion} className="flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-rose-50 hover:text-rose-700">Cerrar sesión</button></div>
    </aside>

    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 px-4 pb-3 pt-safe-top backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><LogoMarca /><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-950">SpendFlow Planner</p><p className="truncate text-xs text-slate-500">Control y flujo futuro</p></div></div><button onClick={cerrarSesion} className="rounded-lg px-2 py-2 text-xs font-semibold text-slate-500">Salir</button></div>
    </header>

    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-5 gap-1">{enlacesMoviles.map((enlace) => <li key={enlace.href}><Link href={enlace.href} className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition ${estaActivo(enlace.href) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500'}`}><Icono nombre={enlace.icono} /><span className="max-w-full truncate">{enlace.etiqueta}</span></Link></li>)}</ul>
    </nav>
  </>;
}
