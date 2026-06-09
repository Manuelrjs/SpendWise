import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NavegacionPrincipal } from '@/components/navegacion-principal';
import { AuthGuard } from '@/components/auth-guard';
import { SelectorTema } from '@/components/selector-tema';

export const metadata: Metadata = {
  title: 'SpendFlow Planner',
  description: 'Gastos, cuotas y compromisos futuros',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SpendFlow',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-icon',
    icon: ['/icon'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0F0F14',
  viewportFit: 'cover',
};

const scriptTema = `(function(){try{var t=localStorage.getItem('spendflow-theme');if(t!=='light-classic'&&t!=='dark-modern')t='dark-modern';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t==='dark-modern'?'dark':'light'}catch(e){document.documentElement.dataset.theme='dark-modern'}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="dark-modern" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: scriptTema }} /></head>
      <body>
        <AuthGuard>
          <div className="sf-app-shell">
            <NavegacionPrincipal />
            <main className="sf-main">{children}</main>
            <div className="sf-public-theme"><SelectorTema compacto /></div>
          </div>
        </AuthGuard>
      </body>
    </html>
  );
}
