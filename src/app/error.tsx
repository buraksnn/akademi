'use client';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <h1>Sayfa yüklenemedi.</h1>
      <p>Bağlantınızı kontrol ederek tekrar deneyin.</p>
      <Button onClick={reset}>Tekrar dene</Button>
    </main>
  );
}
