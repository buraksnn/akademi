'use client';
import Link from 'next/link';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, ArrowRight, CheckCircle2, GraduationCap } from 'lucide-react';
import { registerSchema, loginSchema } from '@/lib/validation';
import { api } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/common';
type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'verify';
function Password({
  name = 'password',
  label = 'Şifre',
  register,
}: {
  name?: string;
  label?: string;
  register: ReturnType<typeof useForm>['register'];
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <span className="password-field">
        <Input
          type={show ? 'text' : 'password'}
          autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
          {...register(name)}
        />
        <button
          type="button"
          aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </Field>
  );
}
function Form({ mode }: { mode: Mode }) {
  const router = useRouter(),
    params = useSearchParams(),
    [file, setFile] = useState<File>(),
    [photoPreview, setPhotoPreview] = useState(''),
    photoUrl = useRef(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => () => URL.revokeObjectURL(photoUrl.current), []);
  const schema =
    mode === 'register'
      ? registerSchema
      : mode === 'login'
        ? loginSchema
        : z.record(z.string(), z.unknown());
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: mode === 'login' ? { remember: false } : undefined,
  });
  const titles = {
    login: 'Tekrar hoş geldiniz.',
    register: 'Akademi’ye katılın.',
    forgot: 'Şifrenizi mi unuttunuz?',
    reset: 'Yeni şifrenizi belirleyin.',
    verify: 'E-posta adresinizi doğrulayın.',
  };
  const descriptions = {
    login: 'Hesabınıza giriş yaparak devam edin.',
    register: 'Akademik yolculuğunuz için ilk adımı atın.',
    forgot: 'Şifre sıfırlama bağlantısını e-posta adresinize gönderelim.',
    reset: 'Hesabınız için en az 12 karakterli bir şifre seçin.',
    verify: 'Hesabınızı etkinleştirmek için aşağıdaki düğmeye basın.',
  };
  const submit = handleSubmit(async (values) => {
    setBusy(true);
    setError('');
    try {
      const paths = {
        login: 'login',
        register: 'register',
        forgot: 'forgot',
        reset: 'reset',
        verify: 'verify',
      };
      const payload = { ...values, token: params.get('token') };
      let body: unknown = payload;
      if (mode === 'register' && file) {
        const form = new FormData();
        form.set('data', JSON.stringify(payload));
        form.set('file', file);
        body = form;
      }
      const result = await api<{ message?: string; redirect?: string }>(
        'auth/' + paths[mode],
        'POST',
        body,
      );
      if (mode === 'login' && result.redirect) {
        router.push(result.redirect);
        router.refresh();
      } else
        setMessage(
          result.message ||
            (mode === 'verify'
              ? 'E-posta adresiniz doğrulandı. Giriş yapabilirsiniz.'
              : 'Şifreniz değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.'),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  });
  return (
    <main className="auth-page">
      <Link href="/giris" className="auth-brand">
        <span className="brand-icon">
          <GraduationCap size={24} />
        </span>
        akademi<span className="brand-dot">.</span>
      </Link>
      <div className="auth-card">
        <span className="eyebrow">ÖĞRENMEYE DEVAM</span>
        <h1>{titles[mode]}</h1>
        <p className="auth-description">{descriptions[mode]}</p>
        {message ? (
          <div className="success-state" role="status">
            <CheckCircle2 size={28} />
            <p>{message}</p>
            <Button asChild>
              <Link href="/giris">
                Giriş ekranına dön <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="form-stack" noValidate>
            {mode === 'register' && (
              <>
                <div className="form-grid">
                  <Field label="Ad">
                    <Input autoComplete="given-name" {...register('firstName')} />
                  </Field>
                  <Field label="Soyad">
                    <Input autoComplete="family-name" {...register('lastName')} />
                  </Field>
                </div>
                <Field
                  label="TC Kimlik Numarası"
                  hint="11 haneli numara yalnızca kayıt eşleştirmesi için kullanılır."
                >
                  <Input
                    inputMode="numeric"
                    maxLength={11}
                    autoComplete="off"
                    {...register('tckn')}
                  />
                </Field>
              </>
            )}
            {(mode === 'register' || mode === 'forgot') && (
              <Field label="E-posta">
                <Input type="email" autoComplete="email" {...register('email')} />
              </Field>
            )}
            {mode === 'login' && (
              <Field label="TC Kimlik Numarası veya E-posta">
                <Input
                  autoComplete="username"
                  placeholder="E-posta veya 11 haneli TC kimlik numarası"
                  {...register('identifier')}
                />
              </Field>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <Password register={register} />
            )}
            {(mode === 'register' || mode === 'reset') && (
              <Password name="confirmPassword" label="Şifre tekrarı" register={register} />
            )}
            {mode === 'register' && (
              <>
                <Field
                  label="Vesikalık fotoğraf (isteğe bağlı)"
                  hint="JPEG, PNG veya WebP · En fazla 5 MB. Profilinizden kırpabilir veya değiştirebilirsiniz."
                >
                  <Input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      if (!selected) return;
                      if (selected.size > 5 * 1024 * 1024) {
                        setError('Fotoğraf en fazla 5 MB olabilir.');
                        e.target.value = '';
                        return;
                      }
                      URL.revokeObjectURL(photoUrl.current);
                      photoUrl.current = URL.createObjectURL(selected);
                      setFile(selected);
                      setPhotoPreview(photoUrl.current);
                    }}
                  />
                </Field>
                {photoPreview && (
                  <img
                    src={photoPreview}
                    className="registration-preview"
                    alt="Seçilen vesikalık önizlemesi"
                  />
                )}
                <p className="field-hint">
                  En az 12 karakter kullanın. Uzun ve benzersiz bir parola seçin.
                </p>
                <label className="checkbox-label">
                  <input type="checkbox" {...register('privacy')} />
                  <span>
                    <Link href="/aydinlatma" target="_blank">
                      Aydınlatma metnini
                    </Link>{' '}
                    okudum ve bilgilendirildim.
                  </span>
                </label>
                <p className="field-hint">
                  TC kimlik numarasının matematiksel kontrolü resmi kimlik doğrulaması değildir.
                  Vesikalık yüklemek isteğe bağlıdır.
                </p>
              </>
            )}
            {mode === 'login' && (
              <div className="form-between">
                <label className="checkbox-label">
                  <input type="checkbox" {...register('remember')} />
                  Beni hatırla
                </label>
                <Link href="/sifremi-unuttum">Şifremi unuttum</Link>
              </div>
            )}
            {(error || Object.keys(errors).length > 0) && (
              <div className="form-error" role="alert">
                {error ||
                  Object.values(errors)
                    .map((v) => String(v?.message || 'Alanları kontrol edin.'))
                    .join(' ')}
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? 'İşlem yapılıyor…'
                : {
                    login: 'Giriş yap',
                    register: 'Hesap oluştur',
                    forgot: 'Bağlantı gönder',
                    reset: 'Şifreyi yenile',
                    verify: 'E-posta adresimi doğrula',
                  }[mode]}
              {!busy && <ArrowRight size={16} />}
            </Button>
          </form>
        )}
        {mode === 'login' && (
          <>
            <p className="auth-footer">
              Hesabın yok mu? <Link href="/kayit">Kayıt ol</Link>
            </p>
            <details className="resend">
              <summary>Doğrulama e-postası gelmedi</summary>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const email = new FormData(e.currentTarget).get('email');
                  try {
                    const r = await api<{ message: string }>('auth/resend', 'POST', { email });
                    setMessage(r.message);
                  } catch (err) {
                    setError((err as Error).message);
                  }
                }}
              >
                <Input
                  name="email"
                  type="email"
                  required
                  aria-label="Doğrulama e-postası"
                  placeholder="E-posta adresiniz"
                />
                <Button variant="outline" type="submit">
                  Yeniden gönder
                </Button>
              </form>
            </details>
          </>
        )}
        {mode !== 'login' && (
          <p className="auth-footer">
            <Link href="/giris">Giriş ekranına dön</Link>
          </p>
        )}
      </div>
      <p className="auth-legal">
        Akademik hayatınız, bir arada.
        <br />
        <Link href="/aydinlatma">Gizlilik ve aydınlatma</Link>
      </p>
    </main>
  );
}
export function AuthForm({ mode }: { mode: Mode }) {
  return (
    <Suspense fallback={<main className="auth-page">Yükleniyor…</main>}>
      <Form mode={mode} />
    </Suspense>
  );
}
