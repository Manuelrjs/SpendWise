import type { Metadata } from 'next';
import './globals.css';
import { NavegacionPrincipal } from '@/components/navegacion-principal';

export const metadata: Metadata = {
  title: 'ControlFlow',
  description: 'Control de gastos familiares y tarjetas',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <div className="min-h-screen md:flex">
          <NavegacionPrincipal />
          <main className="w-full px-4 pb-24 pt-6 md:px-8 md:pb-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
