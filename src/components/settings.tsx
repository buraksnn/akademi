'use client';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/client';
import type { Meta } from './types';
import { PageTitle, Editor, text } from './data-view';
import { Button } from './ui/button';
import { Field, Input } from './ui/common';
export function SettingsPage({ meta }: { meta: Meta }) {
  const router = useRouter(),
    input = useRef<HTMLInputElement>(null);
  const s = meta.settings;
  return (
    <>
      <PageTitle
        title="Kurum ayarları"
        description="Kurum kimliğini, iletişim bilgilerini ve akademik dönemi yönetin."
      />
      <div className="settings-grid">
        <section className="panel padded">
          <h2>Kurum bilgileri</h2>
          <Editor
            onSave={async (f) => {
              await api('settings', 'PATCH', Object.fromEntries(f));
              router.refresh();
            }}
          >
            <Field label="Kurum adı">
              <Input name="name" required defaultValue={s.name} />
            </Field>
            <div className="form-grid">
              <Field label="İletişim e-postası">
                <Input name="email" type="email" defaultValue={'email' in s ? s.email : ''} />
              </Field>
              <Field label="Telefon">
                <Input name="phone" type="tel" defaultValue={'phone' in s ? s.phone : ''} />
              </Field>
            </div>
            <Field label="Adres">
              <textarea
                name="address"
                className="input"
                rows={3}
                defaultValue={'address' in s ? s.address : ''}
              />
            </Field>
            <div className="form-grid">
              <Field label="Akademik yıl">
                <Input name="academicYear" required defaultValue={s.academicYear} />
              </Field>
              <Field label="Saat dilimi">
                <Input name="timezone" required defaultValue={s.timezone} />
              </Field>
            </div>
          </Editor>
          <div className="section-divider">
            <h3>Kurum logosu</h3>
            <p className="muted">
              Öğrenci kimlik kartlarında kullanılır. JPEG, PNG veya WebP; en fazla 5 MB.
            </p>
            {s.hasLogo && <img className="institution-logo" src="/api/logo" alt="Kurum logosu" />}
            <input
              ref={input}
              hidden
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const form = new FormData();
                form.set('file', file);
                try {
                  await api('logo', 'POST', form);
                  toast.success('Kurum logosu güncellendi.');
                  router.refresh();
                } catch (err) {
                  toast.error((err as Error).message);
                }
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => input.current?.click()}>
              <Upload size={15} />
              Logo yükle
            </Button>
          </div>
        </section>
        <div>
          <section className="panel padded">
            <h2>Dersler</h2>
            <div className="reference-list">
              {meta.subjects.map((s) => (
                <span key={s.id}>{s.name}</span>
              ))}
            </div>
            <Editor
              submit="Ders ekle"
              onSave={async (f) => {
                await api('subjects', 'POST', { name: text(f, 'name') });
                router.refresh();
              }}
            >
              <Field label="Yeni ders adı">
                <Input name="name" required minLength={2} />
              </Field>
            </Editor>
          </section>
          <section className="panel padded">
            <h2>Derslikler</h2>
            <div className="reference-list">
              {meta.rooms.map((s) => (
                <span key={s.id}>{s.name}</span>
              ))}
            </div>
            <Editor
              submit="Derslik ekle"
              onSave={async (f) => {
                await api('rooms', 'POST', { name: text(f, 'name') });
                router.refresh();
              }}
            >
              <Field label="Yeni derslik adı">
                <Input name="name" required minLength={2} />
              </Field>
            </Editor>
          </section>
        </div>
      </div>
    </>
  );
}
