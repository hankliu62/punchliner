import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { getRoutePrefix } from '@/lib/route';

export const metadata: Metadata = {
  title: '包袱铺 - Punchliner',
  description: '每天一笑，AI让段子更好玩',
  icons: {
    icon: `${getRoutePrefix()}/favicon.ico`,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="icon" href={`${getRoutePrefix()}/favicon.ico`} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
