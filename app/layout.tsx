import type { Metadata, Viewport } from 'next';
import './globals.css';
import { NavegacionPrincipal } from '@/components/navegacion-principal';

export const metadata: Metadata = {
  title: 'SpendWise',
  description: 'Control familiar de gastos, tarjetas y comprobantes.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'SpendWise',
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
          <main className="w-full px-4 pt-6 pb-safe-bottom md:px-8 md:pb-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
