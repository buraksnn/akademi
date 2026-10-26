# Akademi — Teslim ve doğrulama raporu

Tarih: 26 Ekim 2026.

Gerçek Next.js uygulaması, Prisma/PostgreSQL veri modeli ve migrationları, sunucu yetkilendirmesi, üç Türkçe panel, özel S3 dosya katmanı, SMTP ve Docker dosyaları oluşturuldu. Yalnızca statik tasarım veya tarayıcı belleğinde çalışan bir demo değildir. Teslim arşivi kişisel veri, çalışma veritabanı, `.env`, gerçek anahtar veya demo parolası içermez.

## Son doğrulama

| Kontrol                                                    | Sonuç                                                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| TypeScript                                                 | Geçti                                                                                                     |
| ESLint, sıfır uyarı hedefi                                 | Geçti                                                                                                     |
| Vitest birim testleri                                      | 10 / 10 geçti                                                                                             |
| Gerçek PostgreSQL + Mailpit + S3 HTTP entegrasyon testleri | 23 / 23 geçti                                                                                             |
| Chromium uçtan uca testleri                                | 6 / 6 geçti                                                                                               |
| Toplam otomatik test                                       | **39 / 39 geçti**                                                                                         |
| Production Next.js build                                   | Geçti                                                                                                     |
| `npm start` standalone sunucusu                            | Çalıştı                                                                                                   |
| Docker üretim imajı build                                  | Geçti                                                                                                     |
| Docker runtime kontrolü                                    | Giriş, Secure/HttpOnly/SameSite çerezi, PostgreSQL yönetici özeti ve yabancı Origin reddi geçti           |
| İlk admin CLI                                              | Ayrı test veritabanında stdin üzerinden parola, Argon2id, ADMIN rolü ve ikinci bootstrap reddi doğrulandı |
| Üretim bağımlılık denetimi                                 | `npm audit --omit=dev`: **0 bildirilen açık**                                                             |

Denetimin bulduğu eski Nodemailer/Sharp açıkları Nodemailer 10.2.1 ve Sharp 0.35.5 ile giderildi. Testler bu güncellemeden sonra tekrar geçti. Prisma WASM aracı Node'un deneysel WASM yükleme bildirimini, PostgreSQL sürücüsü ise gelecek pg sürümüne ilişkin bir deprecation bildirimini gösterdi; bu bildirimler test başarısızlığı değildir.

## Temel kabul kriterleri

| Kriter                       | Uygulama ve doğrulama                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| 1. Gerçek kayıt              | PostgreSQL kullanıcı/profil kaydı; isteğe bağlı fotoğraf; SMTP doğrulaması                |
| 2. TC veya e-posta ile giriş | İki giriş yolu da aynı parola ile test edildi                                             |
| 3. Güvenli parola            | Argon2id hash doğrulandı; düz metin parola saklanmaz                                      |
| 4. Rol yönlendirmesi         | Öğrenci, öğretmen ve yönetici URL'leri tarayıcıda doğrulandı                              |
| 5. Üç panel                  | Üç panel gerçek verilerle çalıştı                                                         |
| 6. Öğrenci/öğretmen yönetimi | Yönetici oluşturma, düzenleme, rol, pasifleştirme ve atama servisleri; son admin koruması |
| 7. Sınıf oluşturma           | Tarayıcıdan kayıt ve yenileme sonrası kalıcılık doğrulandı                                |
| 8. Program kaydetme          | Sunucu ve veritabanı düzeyinde öğretmen/derslik/sınıf çakışma reddi                       |
| 9. Öğrenci programı          | Öğrencinin aktif sınıfına ait salt okunur haftalık program                                |
| 10. Deneme sonucu kaydı      | Şablon bazında doğru/yanlış/boş girişi ve kalıcı sonuç                                    |
| 11. Doğru net hesabı         | Çeyrek net, negatif net ve sınır ihlali testleri                                          |
| 12. Ödev takibi              | Atama, öğrenci tamamlama, kalıcılık, öğretmen sınıf durum listesi                         |
| 13. Yoklama                  | Yetkili ders, mükerrer kayıt önleme, admin düzeltmesi ve geçmiş sınıf kaydı               |
| 14. Duyurular                | Rol/sınıf hedefleme, yayınlama, düzenleme ve silme                                        |
| 15. Vesikalık                | Kayıt ve profil yüklemesi, tarayıcıda kırpma/önizleme, değiştirme/kaldırma                |
| 16. Fotoğraf koruması        | Yetkisiz/anonim erişim reddi; içerik kontrolü, yeniden kodlama ve metaveri temizliği      |
| 17. PDF öğrenci kartı        | Yetki kontrollü PDF; Türkçe font ve özel fotoğraf; tarayıcıdan indirme                    |
| 18. Yetkisiz erişim reddi    | Rol, sınıf, nesne, Origin ve oturum testleri                                              |
| 19. Verilerin korunması      | PostgreSQL ve S3; sınıf, ödev ve fotoğraf için sayfa yenileme kontrolleri                 |
| 20. Production build         | Node standalone ve Docker imajı üretildi, runtime kontrol edildi                          |

## Test ortamı ve açık sınırlar

- Veritabanı ve e-posta testleri gerçek PostgreSQL ve Mailpit üzerinde yapıldı. E-posta tokenları gerçek SMTP ile gönderildi, hash ve tek kullanımlılık kontrol edildi.
- MinIO hazır imajlarına erişilemedi; resmi kaynak derlemesindeki bir indirme de ağ politikasına takıldı. Bu nedenle S3 testleri loopback üzerinde çalışan ve anonim isteği reddeden test emülatörüyle yapıldı. **Gerçek MinIO/R2 kurulumu, bucket politikası ve dayanıklılığı bu ortamda doğrulanmadı.** S3 adaptörü ve MinIO kaynak derleme dosyası teslimdedir.
- Gerçek üretim SMTP/S3 hesapları, canlı alan adı, HTTPS reverse proxy ve üretim veri tabanı kurulmadı; uygulama internete yayınlanmadı.
- Kullanıcı tablolarında sunucu sayfalaması vardır. Akademik arşiv listeleri 100/200 kayıtla sınırlıdır; bu listelerin genel arşiv sayfalaması teslimde yoktur.
- Aydınlatma metni kurum tarafından tamamlanacak bir taslaktır. Kurumun saklama/silme politikası ve hukuki metinleri kurum adına hazırlanmış veya onaylanmış sayılmaz.
- Otomatik toplu kişisel veri silme ekranı, bağımsız sızma testi, tam WCAG denetimi ve yedekten geri yükleme tatbikatı bu teslimde yoktur. Bunlar yapılmış gibi raporlanmaz.

## Çalıştırma ve ilk yönetici

```bash
npm ci
npm run setup:env
docker compose up -d --build postgres minio mailpit
npm run db:generate
npm run db:migrate
npm run storage:init
npm run admin:create
npm run dev
```

İlk yönetici parolası CLI içinde gizlenerek istenir; sabit admin parolası bulunmaz. Örnek veriler istenirse ilk admini oluşturmadan önce boş geliştirme veritabanında `npm run db:seed` çalıştırılır. Rastgele geliştirme parolası yalnızca yerel, Git dışındaki `work/development-accounts.md` dosyasına yazılır.

Prisma/MinIO indirme kısıtları için alternatif komutlar README'dedir. Üretim ortamı için HTTPS `APP_URL`, PostgreSQL `DATABASE_URL`, üç ayrı 32 bayt hex anahtar, gerçek SMTP ve özel S3 değişkenleri gerekir; `.env.example` bütün alanları belgeler.

Masaüstü ve mobil ekran görüntüleri production çıktısından, yalnızca açıkça sentetik geliştirme kayıtlarıyla alınmıştır. Gerçek kurum veya öğrenci kaydı değildir.
