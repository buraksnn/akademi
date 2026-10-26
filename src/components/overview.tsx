'use client';
import Link from 'next/link';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  Clock,
  Users,
  BookOpen,
  ClipboardList,
  CheckSquare,
  TrendingUp,
  FileCheck,
} from 'lucide-react';
import type { CurrentUser, Schedules, Assignments, Announcements, Results } from './types';
import { useResource } from '@/lib/client';
import { dateText, clock, days, weekDay } from '@/lib/time';
import { DataView, PageTitle } from './data-view';
import { Empty, Badge, Select } from './ui/common';
const Chart = dynamic(() => import('./chart'), {
  ssr: false,
  loading: () => <div className="skeleton chart" />,
});
type Overview = {
  date: string;
  lessons: Schedules;
  announcements: Announcements;
  assignments: Assignments;
  stats: Record<string, number>;
  unassigned?: boolean;
  latest?: Results[number];
  results?: Results;
  audit?: {
    id: string;
    action: string;
    createdAt: string;
    actor: { firstName: string; lastName: string } | null;
  }[];
};
const auditLabels: Record<string, string> = {
  REGISTER: 'Yeni öğrenci kaydı oluşturuldu',
  LOGIN: 'Hesaba giriş yapıldı',
  CLASS_CREATED: 'Yeni sınıf oluşturuldu',
  CLASS_UPDATED: 'Sınıf bilgileri güncellendi',
  USER_UPDATED: 'Kullanıcı bilgileri güncellendi',
  TEACHER_CREATED: 'Öğretmen hesabı oluşturuldu',
  ENROLLMENT_CHANGED: 'Öğrenci sınıf ataması güncellendi',
  TEACHER_ASSIGNED: 'Öğretmen sınıfa atandı',
  TEACHER_UNASSIGNED: 'Öğretmen ataması kaldırıldı',
  SCHEDULE_SAVED: 'Ders programı kaydedildi',
  SCHEDULE_REMOVED: 'Ders programdan kaldırıldı',
  EXAM_SAVED: 'Deneme sınavı kaydedildi',
  EXAM_RESULT_SAVED: 'Deneme sonucu kaydedildi',
  ASSIGNMENT_SAVED: 'Ödev kaydedildi',
  ASSIGNMENT_DELETED: 'Ödev silindi',
  ANNOUNCEMENT_SAVED: 'Duyuru kaydedildi',
  ANNOUNCEMENT_DELETED: 'Duyuru silindi',
  ATTENDANCE_SAVED: 'Yoklama kaydedildi',
  PHOTO_UPDATED: 'Vesikalık güncellendi',
  PHOTO_REMOVED: 'Vesikalık kaldırıldı',
  SETTINGS_UPDATED: 'Kurum ayarları güncellendi',
  LOGO_UPDATED: 'Kurum logosu güncellendi',
  PASSWORD_RESET: 'Şifre sıfırlandı',
  PASSWORD_CHANGED: 'Şifre değiştirildi',
  EMAIL_VERIFIED: 'E-posta doğrulandı',
};
export function ResultChart({ results }: { results: Results }) {
  const [type, setType] = useState('TYT');
  const rows = results.filter((v) => v.exam.template.type === type);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Net gelişimi</h2>
          <p>Denemelerindeki ilerlemeyi takip et.</p>
        </div>
        <Select aria-label="Sınav türü" value={type} onChange={(e) => setType(e.target.value)}>
          <option>TYT</option>
          <option>AYT</option>
        </Select>
      </div>
      {rows.length ? (
        <Chart
          data={rows.map((r) => ({
            name: new Intl.DateTimeFormat('tr-TR', {
              day: 'numeric',
              month: 'short',
              timeZone: 'Europe/Istanbul',
            }).format(new Date(r.exam.date)),
            net: Number(r.totalNet),
          }))}
        />
      ) : (
        <Empty
          title="Henüz deneme sonucunuz bulunmuyor."
          description="Sonuçlarınız kurumunuz tarafından eklendiğinde burada görüntülenecek."
        />
      )}
    </section>
  );
}
export function Overview({ actor }: { actor: CurrentUser }) {
  const resource = useResource<Overview>('dashboard'),
    base =
      actor.role === 'ADMIN' ? '/yonetim' : actor.role === 'TEACHER' ? '/ogretmen' : '/ogrenci';
  return (
    <DataView resource={resource}>
      {(d) => {
        const student = actor.role === 'STUDENT',
          teacher = actor.role === 'TEACHER',
          latest = d.latest;
        const cards = student
          ? [
              {
                label: 'Bugünkü dersler',
                value: d.stats.lessons,
                detail: 'Ders programını görüntüle',
                Icon: CalendarDays,
                href: 'ders-programi',
              },
              {
                label: 'Son deneme neti',
                value: latest ? Number(latest.totalNet).toLocaleString('tr-TR') : '—',
                detail: latest?.exam.name || 'Henüz sonuç eklenmedi',
                Icon: TrendingUp,
                href: 'denemeler',
              },
              {
                label: 'Bekleyen ödevler',
                value: d.stats.pending,
                detail: 'Ödevlerini kontrol et',
                Icon: FileCheck,
                href: 'odevler',
              },
            ]
          : teacher
            ? [
                {
                  label: 'Bugünkü dersler',
                  value: d.stats.lessons,
                  detail: 'Günlük ders akışın',
                  Icon: CalendarDays,
                  href: 'ders-programi',
                },
                {
                  label: 'Atanmış sınıflar',
                  value: d.stats.classes,
                  detail: 'Sınıflarını görüntüle',
                  Icon: BookOpen,
                  href: 'siniflar',
                },
                {
                  label: 'Bekleyen yoklamalar',
                  value: d.stats.pending,
                  detail: 'Bugün tamamlanacak',
                  Icon: CheckSquare,
                  href: 'yoklama',
                },
              ]
            : [
                {
                  label: 'Aktif öğrenciler',
                  value: d.stats.students,
                  detail: 'Öğrenci kayıtlarını yönet',
                  Icon: Users,
                  href: 'ogrenciler',
                },
                {
                  label: 'Aktif öğretmenler',
                  value: d.stats.teachers,
                  detail: 'Öğretmen kadrosunu yönet',
                  Icon: Users,
                  href: 'ogretmenler',
                },
                {
                  label: 'Sınıflar',
                  value: d.stats.classes,
                  detail: 'Aktif sınıfları görüntüle',
                  Icon: BookOpen,
                  href: 'siniflar',
                },
                {
                  label: 'Yaklaşan denemeler',
                  value: d.stats.exams,
                  detail: 'Yayınlanmış sınavlar',
                  Icon: ClipboardList,
                  href: 'denemeler',
                },
              ];
        return (
          <>
            <PageTitle
              title={
                student
                  ? 'Günaydın, ' + actor.firstName + '.'
                  : teacher
                    ? 'Merhaba, ' + actor.firstName + '.'
                    : 'Kurumunuza genel bakış.'
              }
              description={
                student
                  ? 'Bugünkü akademik özetin.'
                  : teacher
                    ? 'Derslerin, sınıfların ve yapacakların bir arada.'
                    : 'Akademik ve idari süreçlerinizi tek bir yerden takip edin.'
              }
              action={
                <span className="date-chip">
                  <CalendarDays size={15} />
                  {dateText(d.date)}
                </span>
              }
            />
            {d.unassigned && (
              <div className="notice">
                <BookOpen size={20} />
                <div>
                  <strong>Kaydınız oluşturuldu.</strong>
                  <p>Sınıf ataması için kurum yöneticisini bekleyin.</p>
                </div>
              </div>
            )}
            <div className={'stats-grid ' + (cards.length === 3 ? 'three' : '')}>
              {cards.map((c) => (
                <Link href={base + '/' + c.href} className="stat-card" key={c.label}>
                  <div className="stat-label">
                    {c.label}
                    <c.Icon size={17} />
                  </div>
                  <strong>{c.value}</strong>
                  <div className="stat-bottom">
                    <span>{c.detail}</span>
                    <ArrowUpRight size={14} />
                  </div>
                </Link>
              ))}
            </div>
            <div className="dashboard-grid">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>
                      Bugünkü dersler{d.lessons.length > 0 && <Badge>{d.lessons.length}</Badge>}
                    </h2>
                    <p>{days[weekDay(d.date)]} gününün ders programı.</p>
                  </div>
                  <Link className="text-link" href={base + '/ders-programi'}>
                    Tüm program <ArrowRight size={14} />
                  </Link>
                </div>
                {d.lessons.length ? (
                  <div className="lesson-list">
                    {d.lessons.map((l) => (
                      <div className="lesson-row" key={l.id}>
                        <div className="lesson-time">
                          <strong>{clock(l.startMinute)}</strong>
                          <span>{clock(l.endMinute)}</span>
                        </div>
                        <div className="lesson-bar" />
                        <div className="lesson-info">
                          <h3>{l.subject.name}</h3>
                          <p>
                            {l.teacher.user.firstName} {l.teacher.user.lastName}
                          </p>
                        </div>
                        <div className="lesson-place">
                          <Badge>{l.class.name}</Badge>
                          <span>{l.classroom.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Bugün ders bulunmuyor."
                    description="Haftalık derslerinizi ders programı sayfasından görebilirsiniz."
                  />
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>{student ? 'Yapılacak ödevler' : 'Son ödevler'}</h2>
                    <p>{student ? 'Bir sonraki adımına odaklan.' : 'Ödev akışını takip et.'}</p>
                  </div>
                  <Link className="text-link" href={base + '/odevler'}>
                    Tümü <ArrowRight size={14} />
                  </Link>
                </div>
                {d.assignments.length ? (
                  <div className="compact-list">
                    {d.assignments.map((a) => (
                      <Link key={a.id} href={base + '/odevler'} className="task-row">
                        <span className="task-checkbox" />
                        <div>
                          <h3>{a.title}</h3>
                          <p>
                            {a.subject.name} · {dateText(a.dueAt)}
                          </p>
                        </div>
                        <ArrowUpRight size={14} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={student ? 'Bekleyen ödevin yok.' : 'Henüz ödev bulunmuyor.'}
                    description={
                      student
                        ? 'Yeni ödevlerin burada görünecek.'
                        : 'Oluşturulan ödevler burada listelenecek.'
                    }
                  />
                )}
              </section>
              {student && <ResultChart results={d.results || []} />}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Duyurular</h2>
                    <p>Kurumundan son haberler.</p>
                  </div>
                  <Link className="text-link" href={base + '/duyurular'}>
                    Tümü <ArrowRight size={14} />
                  </Link>
                </div>
                {d.announcements.length ? (
                  <div className="compact-list">
                    {d.announcements.map((a) => (
                      <Link className="announcement-row" key={a.id} href={base + '/duyurular'}>
                        <span className="tiny-dot" />
                        <div>
                          <h3>{a.title}</h3>
                          <p>{dateText(a.publishedAt)}</p>
                        </div>
                        <ArrowUpRight size={14} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Henüz duyuru bulunmuyor."
                    description="Kurumunuzun paylaştığı duyurular burada görünecek."
                  />
                )}
              </section>
              {d.audit && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Son işlemler</h2>
                      <p>Kurumdaki son kayıt hareketleri.</p>
                    </div>
                    <Clock size={17} />
                  </div>
                  <div className="compact-list">
                    {d.audit.map((a) => (
                      <div key={a.id} className="audit-row">
                        <span className="tiny-dot" />
                        <div>
                          <h3>{auditLabels[a.action] || 'Kayıt güncellendi'}</h3>
                          <p>
                            {a.actor ? a.actor.firstName + ' ' + a.actor.lastName : 'Sistem'} ·{' '}
                            {new Intl.DateTimeFormat('tr-TR', {
                              timeZone: 'Europe/Istanbul',
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(a.createdAt))}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </>
        );
      }}
    </DataView>
  );
}
