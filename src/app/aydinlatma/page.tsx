import Link from 'next/link';
export default function Page() {
  return (
    <main className="legal-page">
      <Link href="/giris">← Akademi’ye dön</Link>
      <h1>Kişisel verilerin işlenmesi hakkında bilgilendirme</h1>
      <p>
        Bu metin kurum tarafından tamamlanması gereken bir aydınlatma taslağıdır. Veri sorumlusu
        kurumun unvanı, adresi, iletişim kanalı, işleme hukuki sebepleri ve saklama süreleri kurumun
        gerçek uygulamalarına göre belirlenmelidir.
      </p>
      <h2>İşlenen veriler ve amaçları</h2>
      <p>
        Ad, soyad, iletişim bilgileri, şifreli TC kimlik numarası, isteğe bağlı vesikalık ve
        akademik kayıtlar; hesap oluşturma, kurum kaydını eşleştirme, ders programı, sınav
        sonuçları, ödev ve devamsızlık takibi için işlenir. Kimlik numarası matematiksel kontrolü
        resmi kimlik doğrulaması sağlamaz.
      </p>
      <h2>Erişim ve aktarım</h2>
      <p>
        Öğrenciler kendi kayıtlarına, öğretmenler atanmış oldukları sınıfların ilgili akademik
        verilerine, yöneticiler görevlerinin gerektirdiği kayıtlara erişebilir. E-posta ve dosya
        depolama sağlayıcıları kurum tarafından seçilir. Yurt dışı veri aktarımı ve hukuki koşulları
        seçilen sağlayıcılara göre ayrıca değerlendirilmelidir.
      </p>
      <h2>Saklama ve haklarınız</h2>
      <p>
        Veriler hizmetin gerektirdiği süre ve uygulanabilir yasal yükümlülükler kapsamında saklanır.
        Bilgi talebi, düzeltme, itiraz veya silme talepleriniz için kurum yönetimine
        başvurabilirsiniz. Hesap kapatılması geçmiş akademik kayıtları otomatik olarak silmez; kurum
        tarafından doğrulanmış silme prosedürü uygulanır.
      </p>
      <h2>Çerezler</h2>
      <p>
        Oturum açmak için zorunlu, HttpOnly oturum çerezi kullanılır. “Beni hatırla” seçildiğinde
        oturum en fazla 30 gün, aksi halde en fazla 24 saat geçerlidir. Analitik veya reklam çerezi
        kullanılmaz.
      </p>
      <p>
        Vesikalık yükleme isteğe bağlıdır. Bu metni okuduğunuzu onaylamak, pazarlama izni veya tüm
        işlemler için açık rıza anlamına gelmez.
      </p>
    </main>
  );
}
