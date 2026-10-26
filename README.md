# Akademi

Türkçe arayüzlü, tek kurum için dershane yönetimi ve öğrenci takip uygulaması. Gerçek PostgreSQL verileri, SMTP e-postaları ve özel S3 dosya depolaması kullanır. Kurulum boş veritabanıyla başlar; örnek veriler yalnızca açıkça çalıştırılan geliştirme seed komutuyla eklenir.

## Teknolojiler

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4; shadcn/ui yaklaşımındaki Radix, CVA ve yerel UI bileşenleri; Lucide, Recharts, React Hook Form, Zod ve Sonner. Sunucuda Prisma 7 + PostgreSQL, Argon2id, iron-session ile mühürlenen çerezler ve veritabanında iptal edilebilir oturumlar kullanılır. Auth.js yerine bu oturum çözümü seçilmiştir; kayıt ve yetkilendirme iş mantığı uygulama servislerindedir.

S3 adaptörü MinIO veya R2 ile, e-posta katmanı standart SMTP ile çalışır. Uygulama standart Node.js üzerinde ve Docker ile dağıtılabilir. Vercel, Firebase ve Supabase bağımlılığı yoktur. Kesin paket sürümleri `package-lock.json` içinde sabittir.

## Yerel kurulum

Node.js 24 LTS, npm ve Docker Compose gerekir. Komutları proje kökünde çalıştırın:

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

Uygulama: http://localhost:3000 — Mailpit: http://localhost:8025 — MinIO konsolu: http://localhost:9001. Veritabanı ve geliştirme servisleri yalnızca loopback arayüzüne bağlanır. `setup:env` kriptografik olarak rastgele ve birbirinden farklı anahtarlar üretir, mevcut `.env` dosyasının üzerine yazmaz ve değerleri çıktıya yazdırmaz. `.env` Git tarafından yok sayılır.

MinIO için bazı hazır resmi imajlar artık alınamadığından `Dockerfile.minio`, resmi kaynağın sabitlenmiş sürüm commit'inden derleme yapar. İlk derleme Go bağımlılıklarını indirdiği için zaman alır. Bu imaj yerel geliştirme içindir; üretimde desteklenen özel S3 hizmetini kullanın.

### İlk yönetici

`npm run admin:create` ad, soyad, e-posta ve gizlenen şifreyi etkileşimli terminalden ister. En az 12 karakterli parola gerekir. İlk yönetici yalnızca bu güvenilir CLI yoluyla oluşturulur; açık kayıttan yönetici atanamaz. CLI operatörü e-posta adresini güvenilir olarak onaylar. Sonraki yöneticiler mevcut yönetici tarafından kullanıcı detay ekranındaki rol alanından yetkilendirilir. Son aktif yönetici kaldırılamaz.

Otomasyon için CLI `--stdin` ile JSON kabul eder; parola komut satırı argümanında kullanılmamalıdır. Anahtarlar ve parolalar loglanmamalıdır. İlk yöneticiye TC kimlik numarası eklemek istenirse stdin nesnesinde isteğe bağlı `tckn` alanı kullanılabilir. TC kaydı olmayan ilk yönetici e-postayla giriş yapar.

### Örnek geliştirme verileri

İlk yönetici komutunu **çalıştırmadan**, boş geliştirme veritabanında:

```bash
npm run db:seed
npm run dev
```

Seed; 1 yönetici, 2 öğretmen, 5 öğrenci, 2 sınıf, dersler, programlar, 2 deneme, ödev ve duyuru oluşturur. Gerçek kişisel veri ve gerçek formatta TC kimlik kaydı içermez. Bu hesaplar yalnızca e-posta ile giriş yapar. Ortak yerel parola her çalıştırmada rastgele üretilir ve sadece Git dışında tutulan `work/development-accounts.md` dosyasına yazılır. Üretimde seed reddedilir ve dolu veritabanına örnek veri eklenmez. Sabit demo parolası bulunmaz.

## Paneller ve işlevler

- `/giris`, `/kayit`: TC veya e-posta ile giriş, isteğe bağlı kayıt vesikalığı, e-posta doğrulama, kontrollü “Beni hatırla”, tekrar doğrulama gönderimi.
- `/sifremi-unuttum`, `/sifre-yenile`, `/eposta-dogrula`: SMTP bağlantıları, veritabanında token hash'i, süre sınırı ve tek kullanımlılık. Doğrulama işlemi GET ile otomatik yapılmaz; kullanıcı formu onaylar.
- `/ogrenci`: günlük özet, haftalık program, TYT/AYT netleri ve ders sonuçları, gerçek sonuçlardan grafik, ödev tamamlama, devamsızlık, hedefli duyurular ve profil. Sınıfa atanmamış kullanıcıya bekleme ekranı gösterilir.
- `/ogretmen`: kendi programı, atanmış sınıflar, bu sınıfların öğrenci detayları, yetkili ders sonuçları, kendi ödevleri ve bütün sınıfın tamamlama listesi, kendi dersinde yoklama, duyurular ve profil.
- `/yonetim`: kullanıcı arama, sınıf/durum filtresi ve sunucuda sayfalama; öğretmen oluşturma, kullanıcı rolü ve aktiflik yönetimi; sınıf, kayıt ve öğretmen/ders atamaları; çakışma kontrollü haftalık program; sınav şablonları, sınav ve sonuç girişi; ödev, yoklama ve duyuru yönetimi; kurum ayarları, ders ve derslik ekleme.
- Profilde vesikalık yükleme/değiştirme/kaldırma, kare veya 3:4 kırpma ve iki önizleme, doğrulamalı e-posta değişikliği ve şifre değişikliği. Kurum tarafından doğrulanan kimlik alanları öğrenci tarafından değiştirilemez.
- Yönetici öğrenci detayından logo, vesikalık, öğrenci numarası, sınıf ve akademik yıl içeren PDF kartını indirir. Kartta TC kimlik numarası bulunmaz.

Kullanıcı tabloları sayfa başına 20 kayıt sorgular. Sınav ve duyuru listeleri en fazla 100, sonuç, ödev ve devamsızlık listeleri en fazla 200 kayıt döndürür. Bu akademik listeler için genel amaçlı arşiv sayfalaması ilk teslimde yoktur. Büyük geçmiş veri hacimleri için bu sınırlar ve sayfalama genişletilmelidir. Özet sayaçları, liste sınırından bağımsız gerekli sayım sorgularını kullanır; grafik yalnızca döndürülen gerçek sonuçları gösterir.

## Veri modeli ve kurallar

`prisma/schema.prisma` kullanıcılar, rol profilleri, sınıf kayıt geçmişi, öğretmen/ders atamaları, derslikler, haftalık programlar, tarihli oturumlar, sınav şablonları/sonuçları, ödev durumları, yoklama, duyuru hedefleri, fotoğraflar, tokenlar, oturumlar, audit ve kurum ayarlarını normalize eder.

- Öğrenci numarası PostgreSQL sequence üzerinden 1001'den başlar; TC kimlik numarası öğrenci numarası yerine kullanılmaz.
- Aktif ana sınıf, kısmi unique index ile öğrenci başına en fazla birdir. Önceki kayıtların bitiş tarihi korunur.
- `btree_gist` exclusion constraint'leri aynı gün öğretmen, derslik ve sınıf saat çakışmasını engeller. Uygulama da transaction içinde kontrol eder. İlk migration çalıştırılırken veritabanı operatörünün bu uzantıyı kurma yetkisi olmalıdır.
- Netler Decimal'dir, sunucuda `doğru − yanlış / 4` ile hesaplanır. Negatif net mümkündür. Soru sayıları, şablon ilişkileri ve ders neti veritabanı kurallarıyla da korunur.
- Sınav sonuçları olan şablon değiştirilemez. Öğrenciye yalnızca yayınlanmış kendi sonuçları gösterilir. Öğretmenin toplamı, yetkili derslerin net toplamıdır ve arayüzde belirtilir.
- Yoklama öğrenci + tarihli ders oturumu için benzersizdir. Öğretmen ilk kaydı alır; kaydedilen durumu yalnızca yönetici düzeltir. Yönetici sınıfı değişmiş öğrencinin mevcut geçmiş kaydını da düzeltebilir. Aktör ve zaman audit kaydında tutulur.
- Programında yoklama geçmişi olan ders doğrudan değiştirilmez; kapatılıp yenisi oluşturulur. Geçmiş ilişkiler korunur.

## Güvenlik

TC kimlik numarası uygulama seviyesinde AES-256-GCM ile şifrelenir. Rastgele nonce ve doğrulanmış veri etiketi kullanılır. Benzersizlik/eşleştirme ayrı anahtarlı HMAC-SHA256 kör indeksiyle yapılır. İstemciye yalnızca gerekli yerlerde son iki hanesiyle maskelenmiş gösterim çıkar; öğretmenlere kimlik alanları verilmez. Checksum kontrolü kişinin resmi kimlik doğrulaması değildir.

Parolalar Argon2id (64 MiB bellek, 3 tur, 1 paralellik) ile saklanır. Oturum tokenları rastgeledir; veritabanında yalnızca SHA256 hash bulunur. Tarayıcı çerezi iron-session ile şifrelenir, HttpOnly ve SameSite=Lax'tır; üretimde Secure ve `__Host-` öneki kullanılır. Oturum süresi normalde en fazla 24 saat, hatırlama ile 30 gündür. Şifre sıfırlama/değişikliği, e-posta değişimi ve pasifleştirme oturumları iptal eder. Eski parola kontrolünün bir parola değişikliğinden sonra oturum oluşturma yarışını önlemek için oturum açılırken kullanıcı satırı kilitlenip parola hash'i yeniden kontrol edilir.

Bütün hassas işlemler ve dosya okumaları sunucuda rol ve nesne düzeyinde denetlenir. Mutation isteklerinde tam Origin kontrolü yapılır. JSON ve multipart gövdeleri akış okunurken sınırlanır; Content-Length tek başına güvenilir sayılmaz. React metinleri kaçışlar; duyurularda ham HTML çalıştırılmaz. SQL erişimleri Prisma veya parametreli sorgularladır. Güvenli hata mesajları ve temel CSP/güvenlik başlıkları vardır.

Rate limit PostgreSQL'de atomiktir ve birden fazla uygulama sürecinde paylaşılır. Varsayılan `TRUST_PROXY=false` ile istemci IP başlıkları güvenilmez kabul edilip ortak kota kullanılır. Üretimde yalnızca uygulamaya doğrudan erişimi kapatan ve gelen `X-Forwarded-For` başlığını **yeniden yazan** güvenilir reverse proxy arkasında `TRUST_PROXY=true` yapın. Proxy ayrıca 6 MB gövde ve uygun istek zaman aşımı sınırı uygulamalıdır. Kullanıcı kimlikleri/IP'ler rate-limit anahtarında düz metin tutulmaz.

Fotoğraflar en fazla 5 MB, 25 megapiksel girişle JPEG/PNG/WebP olarak kabul edilir. MIME, dosya imzası ve decoder sonucu doğrulanır; görsel döndürülür, küçültülür ve JPEG'e yeniden kodlanır. EXIF/metaveri tutulmaz. Dosya adından bağımsız rastgele obje anahtarı kullanılır. Public dizin veya public URL kullanılmaz. İndirme, yetki kontrollü sunucu rotasından ve `private, no-store` ile yapılır. Fotoğraf anahtarları istemci verisine konmaz. Eski fotoğraflar erişimden hemen kalkar ve depolama temizleme kuyruğuna alınır.

## Ortam ayarları

Tam şablon `.env.example` içindedir. Üretim öncesinde:

- `DATABASE_URL`: TLS kullanılan PostgreSQL URL'si; migration operatörü ve uygulama kullanıcısını ayrı yetkilendirin.
- `APP_URL`: gerçek HTTPS origin'i. `AUTH_SECRET`, `TCKN_ENCRYPTION_KEY`, `TCKN_HMAC_KEY`: **birbirinden farklı**, 32 bayt rastgele hex değerler.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: gerçek SMTP. Üretimde implicit TLS veya zorunlu STARTTLS kullanılır; TLS doğrulaması kapatılmaz. Mailpit sadece geliştirme içindir. Gönderim hatası sessizce yutulmaz.
- `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`: özel S3/MinIO/R2 hizmeti. Üretimde HTTPS endpoint, public erişimi kapalı kova ve yalnızca bu kovadaki gereken objelere erişen servis kimliği gerekir. R2 için uygun endpoint ve `S3_REGION=auto` kullanılabilir.
- Kurumun varsayılan saat dilimi `Europe/Istanbul`'dur. Tarihli ders oturumları ve sınavlar date, ödev teslimleri UTC zaman damgası olarak saklanır. Haftalık saatler kurumun yerel saat dilimindeki dakika alanlarıdır.

```bash
NODE_ENV=production npm run check:env
npm run db:migrate
npm run storage:init
npm run build
npm start
```

Şifreleme anahtarlarını yedekleyin: kaybı TC kimlik verilerinin çözülememesine yol açar. Anahtar rotasyonunda önce yedek ve kontrollü bakım planı hazırlayın; şifreli alanlar yeniden şifrelenmeli, HMAC indeksleri çakışma kontrolüyle yeniden üretilmelidir. `.env`, veri dökümleri, tokenlar ve kişisel veriler repoya/loglara alınmamalıdır. Reverse proxy'de doğrulama/sıfırlama URL'lerinin query string'lerini loglamayın.

## Node.js ve Docker dağıtımı

```bash
docker build -t akademi .
docker run --env-file .env.production -p 127.0.0.1:3000:3000 akademi
```

`npm start`, standalone sunucuya statik dosyaları hazırlayıp bu sunucuyu başlatır. `PORT` ile port değiştirilebilir. Node imajı çok aşamalıdır, standalone Next.js çıktısını kullanır ve root olmayan kullanıcıyla çalışır. Dışarıya HTTPS sunan reverse proxy ve erişilebilir PostgreSQL/SMTP/S3 adresleri gereklidir. Migration ve ilk admin oluşturma komutları runtime imajının başlangıcında otomatik çalıştırılmaz; yetkili operatör tarafından kaynak checkout'unda çalıştırılır. Hiçbir üretim seed'i yoktur.

Oturum, doğrulama tokenları ve eski fotoğraflar için bakım komutunu kurumun işletim zamanlayıcısında düzenli çalıştırın:

```bash
npm run maintenance
```

Bu komut süresi dolmuş oturum/token/rate-limit kayıtlarını ve kuyruktaki eski dosyaları temizler. Akademik kayıtları veya audit geçmişini kendiliğinden silmez. Veritabanı hatasından hemen önce oluşan sahipsiz yüklemeler için ayrıca depolama envanteri denetimi yapılmalıdır.

## Testler

```bash
npm test
npm run typecheck
npm run lint
npm run test:integration
npm run test:e2e
npm run build
```

Entegrasyon testleri PostgreSQL, Mailpit ve yapılandırılmış S3 geliştirme servisini ister. Test çalıştırıcısı varsayılan olarak yerel veritabanı adının sonuna `_test` eklenen ayrı veritabanını oluşturur, migrationları uygular ve **yalnızca** bu test veritabanındaki fixture tablolarını temizler. `TEST_DATABASE_URL` ile açık bir test veritabanı verilebilir; adın `_test` ile bitmesi zorunludur. Test kullanıcısının veritabanı oluşturma yetkisi yoksa test veritabanını önceden oluşturun. Üretim modunda bu çalıştırıcı reddedilir.

Tarayıcı testleri çalışan geliştirme sunucusu ve seed hesaplarını ister; yalnızca geliştirme verilerine sınıf, ödev durumu ve sentetik fotoğraf yazabilir. Hesap parolasını yerel, Git dışındaki seed dosyasından okur. Chromium yolunu `PLAYWRIGHT_CHROMIUM_PATH` ile değiştirin; varsayılan `/usr/bin/chromium`'dur. Sistem Chromium'u yoksa Playwright tarayıcısını kurup yolu belirtin.

### Kısıtlı ağ ortamı için alternatifler

Bu geliştirme oturumunda Prisma'nın native şema motoru indirme alanı ağ politikasıyla engellendi. İstemci/runtime WASM kullanır; native şema indirmesi olmadan gerçek istemciyi üretmek için:

```bash
PRISMA_SCHEMA_ENGINE_BINARY=/usr/bin/false npm run db:generate
npm run db:migrate:wasm
PRISMA_SCHEMA_ENGINE_BINARY=/usr/bin/false npm run build
```

Buradaki binary override sadece kullanılmayan native motorun indirme ön kontrolünü atlar; gerçek Prisma istemci üreticisi çalışır. Migrationlar resmi `@prisma/schema-engine-wasm` ile uygulanır ve standart Prisma migration geçmişine yazılır. Normal ağda standart `db:migrate` kullanılabilir. `scripts/prisma-wasm.mjs` SQL scriptlerini bir bütün olarak PostgreSQL'e gönderir; trigger fonksiyonlarının içindeki noktalı virgülleri bölmez.

MinIO'nun resmi imajları alınamadı ve kaynak derlemesinin bir bağımlılık indirmesi de ağ politikasına takıldı. Bu ortamda depolama testleri localhost üzerinde gerçek S3 HTTP isteklerini işleyen **test emülatörü** ile yapıldı:

```bash
npm run test:storage-server
# Ayrı terminal:
npm run storage:init
```

Test sunucusu `.env` içindeki yerel S3 kimliğini kullanır, loopback dışına bağlanmaz, anonim istekleri reddeder ve üretimde çalıştırılamaz. MinIO ile aynı anda aynı portta çalıştırmayın. Bu, gerçek MinIO/R2 hizmetinin erişim politikası, performansı veya dayanıklılığı için doğrulama sayılmaz. Üretim S3 ve SMTP hizmetleri kendi gerçek hesaplarıyla ayrıca sınanmalıdır. Yönetilen ortamda Docker HTTPS derlemeleri için platformun CA'sı `--secret id=proxy_ca,src="$CODEX_PROXY_CERT"` ile verilebilir; sertifika doğrulaması kapatılmamalıdır.

## Gizlilik ve işletim

`/aydinlatma`, kurumun veri sorumlusu bilgileri ve hukuki gerekçeleriyle tamamlaması gereken bir taslaktır. Metni okuma onayı pazarlama izni veya genel açık rıza olarak kullanılmaz. Vesikalık isteğe bağlıdır. Teknik korumalar tek başına hukuki KVKK uyumluluğu anlamına gelmez.

Hesap pasifleştirme silme değildir; kurum geçmiş akademik kayıtları ve audit ilişkilerini korur. Saklama süreleri, öğrencinin yaşına ve hizmetin hukuki dayanağına göre kurumca yazılı belirlenmelidir. Silme talepleri doğrulandıktan ve yasal saklama yükümlülükleri kontrol edildikten sonra; oturum ve tokenlar iptal edilmeli, fotoğraflar ve depolama kopyaları silinmeli, uygun kişisel alanlar anonimleştirilmeli ve yedeklerin sona erme süreleri uygulanmalıdır. Akademik/audit verileri için açık bir silme/anonimleştirme prosedürü gerekir. Otomatik toplu kişisel veri silme ekranı bu teslimde yoktur.

Üretim kurulumu, gerçek MinIO/R2/SMTP hesapları, kurumun hukuki metinleri, saklama politikası, yedek geri yükleme tatbikatı ve bağımsız güvenlik/erişilebilirlik denetimi bu oturumda yapılmadı. Teslim bu işlemler yapılmış gibi sunulmaz. Ekranlar klavye, görünür odak, etiketli alanlar, dialog odak yönetimi ve mobil taşma kontrolüyle hazırlanmıştır; tam WCAG sertifikasyonu iddiası yoktur.

Veli paneli, ödeme, muhasebe, SMS/WhatsApp, sohbet, yapay zekâ, abonelik, çoklu kurum ve native mobil uygulama kapsam dışıdır.
