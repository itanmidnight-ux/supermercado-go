import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Supermercados Go | Tu supermercado, donde vayas',
  description: 'Compra fácil desde tu casa en Cúcuta. Las mejores ofertas en abarrotes, carnes, frutas, lácteos y más. Delivery y recoge en tienda.',
  icons: { icon: '/images/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
