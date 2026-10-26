'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cropper, { type Area } from 'react-easy-crop';
import { Camera, ShieldCheck, UserRound, Mail, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { api, useResource } from '@/lib/client';
import type { User } from './types';
import { dateText } from '@/lib/time';
import { PageTitle, DataView, Editor, Confirm } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Modal, Badge } from './ui/common';
import { Avatar } from './layout/shell';
async function cropImage(src: string, area: Area) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  const factor = Math.min(1, 900 / area.width, 1200 / area.height);
  canvas.width = Math.round(area.width * factor);
  canvas.height = Math.round(area.height * factor);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tarayıcı görsel düzenlemeyi desteklemiyor.');
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Fotoğraf işlenemedi.'))),
      'image/jpeg',
      0.9,
    ),
  );
}
export function PhotoEditor({
  user,
  onSaved,
}: {
  user: { id: string; firstName: string; lastName: string; photo?: unknown };
  onSaved: () => void;
}) {
  const [image, setImage] = useState(''),
    [crop, setCrop] = useState({ x: 0, y: 0 }),
    [zoom, setZoom] = useState(1),
    [ratio, setRatio] = useState(3 / 4),
    [area, setArea] = useState<Area>(),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState('');
  const input = useRef<HTMLInputElement>(null),
    url = useRef(''),
    previewRef = useRef('');
  useEffect(
    () => () => {
      URL.revokeObjectURL(url.current);
      URL.revokeObjectURL(previewRef.current);
    },
    [],
  );
  const close = () => {
    setImage('');
    setPreview('');
    URL.revokeObjectURL(url.current);
    URL.revokeObjectURL(previewRef.current);
  };
  return (
    <>
      <div className="photo-upload">
        <Avatar user={user} size="large" />
        <div>
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Camera size={15} />
            {user.photo ? 'Fotoğrafı değiştir' : 'Fotoğraf yükle'}
          </Button>
          <p className="field-hint">JPEG, PNG veya WebP · En fazla 5 MB</p>
          {!!user.photo && (
            <Confirm
              title="Vesikalık kaldırılsın mı?"
              label="Fotoğrafı kaldır"
              variant="outline"
              onConfirm={async () => {
                await api('photos/' + user.id, 'DELETE');
                onSaved();
              }}
            >
              Profil fotoğrafınız yerine adınızın baş harfleri gösterilecek.
            </Confirm>
          )}
        </div>
        <input
          hidden
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) {
              toast.error('Dosya en fazla 5 MB olabilir.');
              return;
            }
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
              toast.error('JPEG, PNG veya WebP seçin.');
              return;
            }
            URL.revokeObjectURL(url.current);
            url.current = URL.createObjectURL(file);
            setImage(url.current);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setPreview('');
            e.target.value = '';
          }}
        />
      </div>
      <Modal
        open={!!image}
        onOpenChange={(v) => {
          if (!v) close();
        }}
        title="Vesikalığı düzenle"
        description="Görseli hareket ettirerek kadrajı ayarlayın."
      >
        <div className="crop-container">
          {image && (
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={ratio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <div className="crop-controls">
          <Field label="Oran">
            <Select
              value={ratio}
              onChange={(e) => {
                setRatio(Number(e.target.value));
                setPreview('');
              }}
            >
              <option value={0.75}>3:4 vesikalık</option>
              <option value={1}>Kare</option>
            </Select>
          </Field>
          <Field label="Yakınlaştır">
            <input
              aria-label="Yakınlaştır"
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => {
                setZoom(Number(e.target.value));
                setPreview('');
              }}
            />
          </Field>
        </div>
        {preview && (
          <div className="photo-previews">
            <div>
              <img className="circle-preview" src={preview} alt="Yuvarlak avatar önizlemesi" />
              <small>Avatar</small>
            </div>
            <div>
              <img
                className="portrait-preview"
                src={preview}
                alt="Dikdörtgen vesikalık önizlemesi"
              />
              <small>Vesikalık</small>
            </div>
          </div>
        )}
        <div className="form-actions">
          <Button variant="outline" onClick={close}>
            İptal
          </Button>
          <Button
            variant="outline"
            disabled={!area || busy}
            onClick={async () => {
              try {
                const blob = await cropImage(image, area!);
                URL.revokeObjectURL(previewRef.current);
                previewRef.current = URL.createObjectURL(blob);
                setPreview(previewRef.current);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Önizleme
          </Button>
          <Button
            disabled={!area || busy}
            onClick={async () => {
              setBusy(true);
              try {
                const blob = await cropImage(image, area!),
                  form = new FormData();
                form.set('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
                await api('photos/' + user.id, 'POST', form);
                close();
                onSaved();
                toast.success('Fotoğrafınız güncellendi.');
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Yükleniyor…' : 'Fotoğrafı kaydet'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
export function ProfilePage() {
  const r = useResource<User>('me'),
    router = useRouter();
  return (
    <>
      <PageTitle
        title="Profilim"
        description="Hesap bilgilerinizi, vesikalığınızı ve güvenlik ayarlarınızı yönetin."
      />
      <DataView resource={r}>
        {(u) => (
          <div className="profile-grid">
            <section className="panel profile-info">
              <div className="panel-heading">
                <h2>
                  <UserRound size={17} />
                  Kişisel bilgiler
                </h2>
                <Badge tone="green">{u.active ? 'Aktif' : 'Pasif'}</Badge>
              </div>
              <PhotoEditor
                user={u}
                onSaved={() => {
                  r.refresh();
                  router.refresh();
                }}
              />
              <dl className="profile-fields">
                <div>
                  <dt>Ad ve soyad</dt>
                  <dd>
                    {u.firstName} {u.lastName}
                  </dd>
                </div>
                {u.student && (
                  <>
                    <div>
                      <dt>Öğrenci numarası</dt>
                      <dd>{u.student.number}</dd>
                    </div>
                    <div>
                      <dt>Sınıf</dt>
                      <dd>{u.student.enrollments[0]?.class.name || 'Sınıfa atanmamış'}</dd>
                    </div>
                  </>
                )}
                <div>
                  <dt>E-posta</dt>
                  <dd>{u.email}</dd>
                </div>
                <div>
                  <dt>TC kimlik numarası</dt>
                  <dd>
                    {'tcLastTwo' in u && u.tcLastTwo ? '•••••••••' + u.tcLastTwo : 'Kayıtlı değil'}
                  </dd>
                </div>
                <div>
                  <dt>Kayıt tarihi</dt>
                  <dd>{dateText(u.createdAt)}</dd>
                </div>
              </dl>
              <p className="profile-note">
                <ShieldCheck size={17} />
                Kimlik bilgilerinizde değişiklik için kurum yönetimine başvurun.
              </p>
            </section>
            <div className="profile-security">
              <section className="panel padded">
                <h2>
                  <Mail size={17} />
                  E-posta değişikliği
                </h2>
                <p className="muted">
                  Yeni adres doğrulanana kadar mevcut adresiniz kullanılmaya devam eder.
                </p>
                <Editor
                  submit="Doğrulama bağlantısı gönder"
                  onSave={async (f) => {
                    await api('profile/email', 'POST', Object.fromEntries(f));
                    toast.success('Yeni adresinize doğrulama bağlantısı gönderildi.');
                  }}
                >
                  <Field label="Yeni e-posta adresi">
                    <Input name="email" type="email" required autoComplete="email" />
                  </Field>
                  <Field label="Mevcut şifreniz">
                    <Input
                      name="password"
                      type="password"
                      required
                      maxLength={128}
                      autoComplete="current-password"
                    />
                  </Field>
                </Editor>
              </section>
              <section className="panel padded">
                <h2>
                  <KeyRound size={17} />
                  Şifre değişikliği
                </h2>
                <p className="muted">Şifre değiştiğinde tüm açık oturumlarınız kapatılır.</p>
                <Editor
                  submit="Şifreyi değiştir"
                  onSave={async (f) => {
                    await api('profile/password', 'POST', Object.fromEntries(f));
                    router.push('/giris');
                    router.refresh();
                  }}
                >
                  <Field label="Mevcut şifre">
                    <Input
                      type="password"
                      name="currentPassword"
                      autoComplete="current-password"
                      maxLength={128}
                      required
                    />
                  </Field>
                  <Field label="Yeni şifre">
                    <Input
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                  </Field>
                  <Field label="Yeni şifre tekrarı">
                    <Input
                      type="password"
                      name="confirmPassword"
                      autoComplete="new-password"
                      required
                    />
                  </Field>
                </Editor>
              </section>
            </div>
          </div>
        )}
      </DataView>
    </>
  );
}
