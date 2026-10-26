import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Akademi — Dershane Yönetimi', template: '%s · Akademi' },
  description: 'Ders programı, deneme sonuçları, ödevler ve kurum yönetimi tek bir yerde.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <Toaster richColors position="bottom-right" closeButton />
      </body>
    </html>
  );
}
