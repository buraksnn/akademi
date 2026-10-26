'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, ArrowLeft, ArrowRight, Download, ArrowUpRight } from 'lucide-react';
import type { CurrentUser, Meta, Users, User, Results } from './types';
import { api, useResource } from '@/lib/client';
import { dateText } from '@/lib/time';
import { PageTitle, DataView, Editor, text } from './data-view';
import { Field, Input, Select, Modal, Empty, Badge } from './ui/common';
import { Button } from './ui/button';
import { Avatar } from './layout/shell';
import { PhotoEditor } from './profile';
import { ResultChart } from './overview';
export function UserDetail({
  id,
  actor,
  meta,
  onSaved,
}: {
  id: string;
  actor: CurrentUser;
  meta: Meta;
  onSaved: () => void;
}) {
  const r = useResource<User>('users/' + id);
  return (
    <DataView resource={r}>
      {(u) => (
        <>
          <div className="detail-identity">
            <Avatar user={u} size="large" />
            <div>
              <h3>
                {u.firstName} {u.lastName}
              </h3>
              <p>{u.email}</p>
              <Badge tone={u.active ? 'green' : 'neutral'}>{u.active ? 'Aktif' : 'Pasif'}</Badge>
            </div>
            {u.role === 'STUDENT' && u.student && actor.role === 'ADMIN' && (
              <Button asChild variant="outline">
                <a href={'/api/users/' + id + '/card'} download>
                  <Download size={15} />
                  Öğrenci kartı
                </a>
              </Button>
            )}
          </div>
          {actor.role === 'ADMIN' ? (
            <>
              <Editor
                onSave={async (f) => {
                  await api('users/' + id, 'PATCH', {
                    firstName: text(f, 'firstName'),
                    lastName: text(f, 'lastName'),
                    active: text(f, 'active') === 'true',
                    role: text(f, 'role'),
                  });
                  r.refresh();
                  onSaved();
                }}
              >
                <div className="form-grid">
                  <Field label="Ad">
                    <Input name="firstName" defaultValue={u.firstName} required />
                  </Field>
                  <Field label="Soyad">
                    <Input name="lastName" defaultValue={u.lastName} required />
                  </Field>
                  <Field label="Hesap durumu">
                    <Select name="active" defaultValue={String(u.active)}>
                      <option value="true">Aktif</option>
                      <option value="false">Pasif</option>
                    </Select>
                  </Field>
                  <Field label="Rol">
                    <Select name="role" defaultValue={u.role}>
                      <option value="STUDENT">Öğrenci</option>
                      <option value="TEACHER">Öğretmen</option>
                      <option value="ADMIN">Yönetici</option>
                    </Select>
                  </Field>
                </div>
                <p className="field-hint">
                  TC kimlik:{' '}
                  {'tcLastTwo' in u && u.tcLastTwo ? '•••••••••' + u.tcLastTwo : 'Kayıtlı değil'} ·
                  Kayıt: {dateText(u.createdAt)} · E-posta:{' '}
                  {u.emailVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
                </p>
              </Editor>
              {u.role === 'STUDENT' && u.student && (
                <Editor
                  title="Sınıf ataması"
                  onSave={async (f) => {
                    await api('enrollments', 'POST', {
                      studentId: u.student!.id,
                      classId: text(f, 'classId') || null,
                    });
                    r.refresh();
                    onSaved();
                  }}
                >
                  <Field label="Aktif ana sınıf">
                    <Select name="classId" defaultValue={u.student.enrollments[0]?.class.id || ''}>
                      <option value="">Sınıfa atanmamış</option>
                      {meta.classes.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </Editor>
              )}
              <div className="section-divider">
                <h3>Vesikalık</h3>
                <PhotoEditor
                  user={u}
                  onSaved={() => {
                    r.refresh();
                    onSaved();
                  }}
                />
              </div>
            </>
          ) : (
            <p className="muted">
              Öğrenci no: {u.student?.number} · Sınıf:{' '}
              {u.student?.enrollments[0]?.class.name || 'Atanmamış'}
            </p>
          )}
          {u.student && <StudentResults studentId={u.student.id} />}
        </>
      )}
    </DataView>
  );
}
function StudentResults({ studentId }: { studentId: string }) {
  const r = useResource<Results>('results?studentId=' + studentId);
  return (
    <DataView resource={r}>
      {(rows) => (
        <div className="section-divider">
          <ResultChart results={rows} />
          {rows.map((row) => (
            <div className="detail-result" key={row.id}>
              <strong>{row.exam.name}</strong>
              <span>
                {Number(row.totalNet).toLocaleString('tr-TR')} net
                {row.partial ? ' (yetkili dersler)' : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </DataView>
  );
}
export function UsersPage({
  actor,
  meta,
  teachers = false,
  fixedClass,
}: {
  actor: CurrentUser;
  meta: Meta;
  teachers?: boolean;
  fixedClass?: string;
}) {
  const router = useRouter(),
    [q, setQ] = useState(''),
    [classId, setClass] = useState(fixedClass || ''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(''),
    [create, setCreate] = useState(false);
  const path =
      'users?' +
      new URLSearchParams({
        role: teachers ? 'TEACHER' : 'STUDENT',
        q,
        classId,
        status,
        page: String(page),
      }),
    r = useResource<Users>(path);
  const admin = actor.role === 'ADMIN';
  return (
    <>
      {!fixedClass && (
        <PageTitle
          title={teachers ? 'Öğretmenler' : admin ? 'Öğrenciler' : 'Öğrencilerim'}
          description={
            teachers
              ? 'Öğretmen kadrosunu ve yetkilerini yönetin.'
              : admin
                ? 'Öğrenci kayıtlarını, sınıf atamalarını ve durumlarını yönetin.'
                : 'Atanmış sınıflarınızdaki öğrencileri görüntüleyin.'
          }
          action={
            admin && teachers ? (
              <Button onClick={() => setCreate(true)}>
                <Plus size={16} />
                Öğretmen ekle
              </Button>
            ) : undefined
          }
        />
      )}
      <section className="panel">
        <div className="table-toolbar">
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(text(new FormData(e.currentTarget), 'q'));
              setPage(1);
            }}
          >
            <Search size={16} />
            <Input
              name="q"
              placeholder={teachers ? 'Öğretmen ara…' : 'Ad, e-posta veya öğrenci no ara…'}
              aria-label="Kayıtlarda ara"
            />
            <Button variant="ghost" size="sm" type="submit">
              Ara
            </Button>
          </form>
          <div className="filters">
            {!teachers && !fixedClass && (
              <Select
                aria-label="Sınıf filtresi"
                value={classId}
                onChange={(e) => {
                  setClass(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tüm sınıflar</option>
                {meta.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <Select
              aria-label="Durum filtresi"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </Select>
          </div>
        </div>
        <DataView resource={r}>
          {(data) => (
            <>
              {data.items.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{teachers ? 'Öğretmen' : 'Öğrenci'}</th>
                        <th>{teachers ? 'Atanmış dersler' : 'Öğrenci no'}</th>
                        <th>{teachers ? 'Sınıflar' : 'Sınıf'}</th>
                        <th>Durum</th>
                        <th>
                          <span className="sr-only">İşlemler</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((u) => (
                        <tr key={u.id}>
                          <td>
                            <button className="person-cell" onClick={() => setSelected(u.id)}>
                              <Avatar user={u} />
                              <span>
                                <strong>
                                  {u.firstName} {u.lastName}
                                </strong>
                                <small>{u.email}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            {teachers
                              ? [
                                  ...new Set(u.teacher?.assignments.map((a) => a.subject.name)),
                                ].join(', ') || 'Atanmamış'
                              : u.student?.number}
                          </td>
                          <td>
                            {teachers
                              ? [...new Set(u.teacher?.assignments.map((a) => a.class.name))].join(
                                  ', ',
                                ) || 'Atanmamış'
                              : u.student?.enrollments[0]?.class.name || (
                                  <span className="muted">Atanmamış</span>
                                )}
                          </td>
                          <td>
                            <Badge tone={u.active ? 'green' : 'neutral'}>
                              {u.active ? 'Aktif' : 'Pasif'}
                            </Badge>
                          </td>
                          <td>
                            <Button variant="ghost" size="sm" onClick={() => setSelected(u.id)}>
                              Detay <ArrowUpRight size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title="Kayıt bulunamadı."
                  description="Arama ve filtreleri kontrol edin. Yeni öğrenci hesapları kayıt ekranından oluşturulur."
                />
              )}
              <div className="pagination">
                <span>
                  {data.total} kayıt · Sayfa {data.page} /{' '}
                  {Math.max(1, Math.ceil(data.total / data.pageSize))}
                </span>
                <div>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Önceki sayfa"
                    disabled={page <= 1}
                    onClick={() => setPage((v) => v - 1)}
                  >
                    <ArrowLeft size={15} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Sonraki sayfa"
                    disabled={page * 20 >= data.total}
                    onClick={() => setPage((v) => v + 1)}
                  >
                    <ArrowRight size={15} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </DataView>
      </section>
      <Modal
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected('');
        }}
        title={teachers ? 'Öğretmen detayları' : 'Öğrenci detayları'}
        wide
      >
        {selected && (
          <UserDetail
            key={selected}
            id={selected}
            actor={actor}
            meta={meta}
            onSaved={() => {
              r.refresh();
              router.refresh();
            }}
          />
        )}
      </Modal>
      <Modal open={create} onOpenChange={setCreate} title="Öğretmen hesabı oluştur">
        <Editor
          submit="Hesap oluştur ve doğrulama gönder"
          onSave={async (f) => {
            await api('teachers', 'POST', Object.fromEntries(f));
            setCreate(false);
            r.refresh();
            router.refresh();
          }}
        >
          <div className="form-grid">
            <Field label="Ad">
              <Input name="firstName" required minLength={2} />
            </Field>
            <Field label="Soyad">
              <Input name="lastName" required minLength={2} />
            </Field>
          </div>
          <Field label="E-posta">
            <Input name="email" type="email" required />
          </Field>
          <Field label="TC Kimlik Numarası">
            <Input name="tckn" inputMode="numeric" maxLength={11} required />
          </Field>
          <Field
            label="İlk şifre"
            hint="Öğretmen giriş yapmadan önce e-posta adresini doğrulamalı."
          >
            <Input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </Field>
        </Editor>
      </Modal>
    </>
  );
}
