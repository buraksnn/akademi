'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap, Menu, X, LogOut, ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { Actor } from '@/lib/auth/session';
import type { Serialized } from '@/lib/client';
import { api } from '@/lib/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { studentMenu, teacherMenu, adminMenu } from './navigation';
export function Avatar({
  user,
  size = 'normal',
}: {
  user: { id: string; firstName: string; lastName: string; photo?: unknown };
  size?: string;
}) {
  const photo = user.photo as { updatedAt?: string | Date } | undefined;
  const version = photo?.updatedAt ? encodeURIComponent(String(photo.updatedAt)) : '';
  return (
    <span className={'avatar ' + size}>
      {user.photo ? (
        <img
          src={'/api/photos/' + user.id + '?v=' + version}
          alt={user.firstName + ' ' + user.lastName}
        />
      ) : (
        user.firstName[0] + user.lastName[0]
      )}
    </span>
  );
}
export function Shell({
  actor,
  section,
  institution,
  year,
  children,
}: {
  actor: Serialized<Actor>;
  section: string;
  institution: string;
  year: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false),
    router = useRouter();
  const base =
    actor.role === 'ADMIN' ? '/yonetim' : actor.role === 'TEACHER' ? '/ogretmen' : '/ogrenci';
  const menu =
    actor.role === 'ADMIN' ? adminMenu : actor.role === 'TEACHER' ? teacherMenu : studentMenu;
  const role =
    actor.role === 'ADMIN' ? 'Yönetici' : actor.role === 'TEACHER' ? 'Öğretmen' : 'Öğrenci';
  const title =
    section === 'profil' ? 'Profilim' : menu.find((v) => v[0] === section)?.[1] || 'Genel Bakış';
  return (
    <div className="app-layout">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      {open && (
        <button
          aria-label="Menüyü kapat"
          className="mobile-overlay"
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={'sidebar ' + (open ? 'open' : '')}>
        <Link className="brand" href={base}>
          <span className="brand-icon">
            <GraduationCap size={22} />
          </span>
          <span>
            akademi<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="institution">
          <span className="institution-mark">{institution.slice(0, 1)}</span>
          <div>
            <strong>{institution}</strong>
            <small>{year} akademik yılı</small>
          </div>
        </div>
        <p className="nav-caption">{role.toLocaleUpperCase('tr-TR')} PANELİ</p>
        <nav aria-label="Ana menü">
          {menu.map(([href, label, Icon], i) => (
            <Link
              key={href}
              href={base + (href ? '/' + href : '')}
              onClick={() => setOpen(false)}
              className={
                (href === section ? 'active ' : '') + (i === menu.length - 1 ? 'last' : '')
              }
              aria-current={href === section ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {href === section && <span className="active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-note">
            <ShieldCheck size={18} />
            <div>
              <strong>Bilgileriniz güvende.</strong>
              <p>Yalnızca yetkili olduğunuz kayıtlara erişirsiniz.</p>
            </div>
          </div>
          <Link
            className={'account ' + (section === 'profil' ? 'selected' : '')}
            href={base + '/profil'}
          >
            <Avatar user={actor} />
            <span>
              <strong>
                {actor.firstName} {actor.lastName}
              </strong>
              <small>{role}</small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
          <button
            className="logout"
            onClick={async () => {
              try {
                await api('auth/logout', 'POST', {});
                router.push('/giris');
                router.refresh();
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <LogOut size={15} />
            Çıkış yap
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-toggle"
              aria-label={open ? 'Menüyü kapat' : 'Menüyü aç'}
              onClick={() => setOpen(!open)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span>{role} Paneli</span>
            <span className="slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="year-label">{year}</span>
            <Link href={base + '/profil'} aria-label="Profilim">
              <Avatar user={actor} size="small" />
            </Link>
          </div>
        </header>
        <main id="main" className="main-content">
          {children}
          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} {institution}
            </span>
            <span>Akademik hayatınız, bir arada.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
