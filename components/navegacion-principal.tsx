'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthSpendWise } from '@/components/auth-context';
import { SelectorTema } from '@/components/selector-tema';

type IconoNombre = 'inicio' | 'nuevo' | 'gastos' | 'reportes' | 'tarjetas' | 'calendario' | 'flujo' | 'cuotas' | 'grupo' | 'personas' | 'categorias' | 'pagos' | 'ajustes' | 'mas';
type Enlace = { href: string; etiqueta: string; icono: IconoNombre };
type GrupoEnlaces = { titulo: string; enlaces: Enlace[] };

const gruposEnlaces: GrupoEnlaces[] = [
  { titulo: 'Planificación', enlaces: [
    { href: '/', etiqueta: 'Inicio', icono: 'inicio' }, { href: '/gastos/nuevo', etiqueta: 'Nuevo gasto', icono: 'nuevo' },
    { href: '/gastos', etiqueta: 'Gastos', icono: 'gastos' }, { href: '/flujo', etiqueta: 'Flujo mensual', icono: 'flujo' },
    { href: '/reportes', etiqueta: 'Reportes', icono: 'reportes' },
  ] },
  { titulo: 'Tarjetas', enlaces: [
    { href: '/tarjetas', etiqueta: 'Tarjetas', icono: 'tarjetas' }, { href: '/calendario', etiqueta: 'Calendario', icono: 'calendario' },
    { href: '/cuotas-iniciales', etiqueta: 'Cuotas iniciales', icono: 'cuotas' },
  ] },
  { titulo: 'Configuración', enlaces: [
    { href: '/configuracion/grupo', etiqueta: 'Grupo', icono: 'grupo' }, { href: '/configuracion/personas', etiqueta: 'Personas', icono: 'personas' },
    { href: '/configuracion/categorias', etiqueta: 'Categorías', icono: 'categorias' }, { href: '/configuracion/medios-pago', etiqueta: 'Medios de pago', icono: 'pagos' },
    { href: '/configuracion/mantenimiento', etiqueta: 'Mantenimiento', icono: 'ajustes' },
  ] },
];
const enlacesPrincipales = [gruposEnlaces[0].enlaces[0], gruposEnlaces[0].enlaces[2], gruposEnlaces[0].enlaces[1], gruposEnlaces[0].enlaces[3]];
const enlacesMas = [gruposEnlaces[0].enlaces[4], ...gruposEnlaces[1].enlaces, ...gruposEnlaces[2].enlaces];

function Icono({ nombre }: { nombre: IconoNombre }) {
  const trazos: Record<IconoNombre, React.ReactNode> = {
    inicio: <><path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9 21v-7h6v7"/></>, nuevo: <><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></>,
    gastos: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h4"/></>, reportes: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    tarjetas: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>, calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></>,
    flujo: <><path d="M4 17l5-5 4 3 7-8"/><path d="M15 7h5v5"/></>, cuotas: <><path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3"/></>,
    grupo: <><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 15c3 0 5 1.7 5 5"/></>, personas: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></>,
    categorias: <><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></>, pagos: <><path d="M3 7h18v12H3zM3 11h18M7 15h3"/></>,
    ajustes: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
    mas: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-none stroke-current stroke-[1.8]" strokeLinecap="round" strokeLinejoin="round">{trazos[nombre]}</svg>;
}
function LogoMarca() { return <span className="sf-brand-mark"><Icono nombre="flujo" /></span>; }

export function NavegacionPrincipal() {
  const pathname = usePathname(); const router = useRouter();
  const { session, perfil, cerrarSesion: cerrarSesionAuth } = useAuthSpendWise();
  const [masAbierto, setMasAbierto] = useState(false);
  useEffect(() => { setMasAbierto(false); }, [pathname]);
  useEffect(() => {
    if (!masAbierto) return;
    const cerrarConEscape = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setMasAbierto(false); };
    document.body.style.overflow = 'hidden'; document.addEventListener('keydown', cerrarConEscape);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', cerrarConEscape); };
  }, [masAbierto]);
  if (pathname === '/login' || pathname === '/registro' || pathname === '/aceptar-invitacion') return null;

  const estaActivo = (href: string) => href === '/' ? pathname === '/' : pathname.startsWith(href);
  const cerrarSesion = async () => { await cerrarSesionAuth(); router.replace('/login'); };
  const nombreGrupo = perfil?.grupo_nombre ?? 'Preparando grupo...'; const email = session?.user.email ?? 'Sesión activa';

  return <>
    <aside className="sf-sidebar">
      <div className="sf-sidebar-brand"><div className="sf-brand"><LogoMarca /><div><p>SpendFlow Planner</p><span>Control y flujo futuro</span></div></div><div className="sf-context-card"><span>Grupo activo</span><strong>{nombreGrupo}</strong><small>{email}</small></div></div>
      <nav className="sf-sidebar-nav" aria-label="Navegación principal">{gruposEnlaces.map((grupo) => <div key={grupo.titulo} className="sf-nav-group"><p>{grupo.titulo}</p><div>{grupo.enlaces.map((enlace) => <Link key={enlace.href} href={enlace.href} className={`sf-nav-link ${estaActivo(enlace.href) ? 'is-active' : ''}`}><Icono nombre={enlace.icono} /><span>{enlace.etiqueta}</span></Link>)}</div></div>)}</nav>
      <div className="sf-sidebar-footer"><SelectorTema /><button onClick={cerrarSesion} className="sf-signout">Cerrar sesión</button></div>
    </aside>

    <header className="sf-mobile-header"><div className="sf-brand"><LogoMarca /><div><p>SpendFlow</p><span>{nombreGrupo}</span></div></div><Link href="/configuracion/grupo" className="sf-mobile-group" aria-label="Abrir grupo activo">Grupo</Link></header>
    <nav className="sf-bottom-nav" aria-label="Navegación móvil"><ul>{enlacesPrincipales.map((enlace) => <li key={enlace.href}><Link href={enlace.href} className={`${estaActivo(enlace.href) ? 'is-active' : ''} ${enlace.href === '/gastos/nuevo' ? 'is-primary' : ''}`}><Icono nombre={enlace.icono} /><span>{enlace.etiqueta === 'Nuevo gasto' ? 'Nuevo' : enlace.etiqueta === 'Flujo mensual' ? 'Flujo' : enlace.etiqueta}</span></Link></li>)}<li><button type="button" className={masAbierto || enlacesMas.some((enlace) => estaActivo(enlace.href)) ? 'is-active' : ''} onClick={() => setMasAbierto(true)} aria-haspopup="dialog" aria-expanded={masAbierto}><Icono nombre="mas" /><span>Más</span></button></li></ul></nav>

    {masAbierto ? <div className="sf-drawer-backdrop" onClick={() => setMasAbierto(false)}><section className="sf-drawer" role="dialog" aria-modal="true" aria-label="Más opciones" onClick={(evento) => evento.stopPropagation()}><header className="sf-drawer-header"><div><p>Más opciones</p><span>{nombreGrupo} · {email}</span></div><button type="button" className="sf-drawer-close" onClick={() => setMasAbierto(false)} aria-label="Cerrar menú">×</button></header><div className="sf-drawer-body"><nav className="sf-drawer-grid">{enlacesMas.map((enlace) => <Link key={enlace.href} href={enlace.href} className={`sf-drawer-link ${estaActivo(enlace.href) ? 'is-active' : ''}`}><Icono nombre={enlace.icono} /><span>{enlace.etiqueta}</span></Link>)}</nav><div className="sf-drawer-actions"><SelectorTema /><button type="button" onClick={cerrarSesion} className="sf-drawer-signout">Cerrar sesión</button></div></div></section></div> : null}
  </>;
}
