import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="auth-page">
      <h1>Sayfa bulunamadı.</h1>
      <p>Bu bağlantı artık kullanılmıyor olabilir.</p>
      <Link href="/">Ana sayfaya dön</Link>
    </main>
  );
}
