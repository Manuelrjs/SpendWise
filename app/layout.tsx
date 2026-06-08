import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NavegacionPrincipal } from '@/components/navegacion-principal';
import { AuthGuard } from '@/components/auth-guard';

export const metadata: Metadata = {
  title: 'SpendFlow Planner',
  description: 'Gastos, cuotas y compromisos futuros',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SpendFlow',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/apple-icon',
    icon: ['/icon'],
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen md:flex">
          <NavegacionPrincipal />
          <main className="min-w-0 w-full px-4 pb-safe-bottom pt-5 sm:px-6 md:px-8 md:pb-10 md:pt-8 xl:px-10"><AuthGuard>{children}</AuthGuard></main>
        </div>
      </body>
    </html>
  );
}
