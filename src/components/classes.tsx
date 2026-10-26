'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, BookOpen, ArrowUpRight } from 'lucide-react';
import { api, useResource } from '@/lib/client';
import type { Classes, Meta, CurrentUser } from './types';
import { PageTitle, DataView, Editor, text, Confirm } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Empty, Modal } from './ui/common';
import { UsersPage } from './users';
export function ClassesPage({ actor, meta }: { actor: CurrentUser; meta: Meta }) {
  const r = useResource<Classes>('classes'),
    router = useRouter(),
    [edit, setEdit] = useState<Classes[number] | null>(),
    [selected, setSelected] = useState(''),
    admin = actor.role === 'ADMIN';
  return (
    <>
      <PageTitle
        title={admin ? 'Sınıflar' : 'Sınıflarım'}
        description={
          admin
            ? 'Sınıfları, öğrenci yerleşimlerini ve öğretmen atamalarını yönetin.'
            : 'Atanmış sınıflarınız ve öğrenci listeleri.'
        }
        action={
          admin && (
            <Button onClick={() => setEdit(null)}>
              <Plus size={16} />
              Sınıf oluştur
            </Button>
          )
        }
      />
      <DataView resource={r}>
        {(classes) =>
          classes.length ? (
            <div className="classes-grid">
              {classes.map((c) => (
                <section className="panel class-card" key={c.id}>
                  <div className="class-card-top">
                    <span className="class-icon">
                      <BookOpen size={20} />
                    </span>
                    {admin && (
                      <Button variant="ghost" size="sm" onClick={() => setEdit(c)}>
                        Düzenle
                      </Button>
                    )}
                  </div>
                  <h2>{c.name}</h2>
                  <p>{c.description || 'Sınıf bilgileri ve akademik takip.'}</p>
                  <div className="class-stats">
                    <span>
                      <Users size={16} />
                      {c._count.enrollments} öğrenci
                    </span>
                    <span>{c._count.teachers} ders ataması</span>
                  </div>
                  <div className="class-teachers">
                    {c.teachers.slice(0, 3).map((t) => (
                      <div key={t.id}>
                        <strong>{t.subject.name}</strong>
                        <span>
                          {t.teacher.user.firstName} {t.teacher.user.lastName}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" onClick={() => setSelected(c.id)}>
                    Öğrenci listesini görüntüle <ArrowUpRight size={15} />
                  </Button>
                </section>
              ))}
            </div>
          ) : (
            <Empty
              title={admin ? 'Henüz sınıf oluşturulmadı.' : 'Henüz bir sınıfa atanmadınız.'}
              description={
                admin
                  ? 'İlk sınıfınızı oluşturarak öğrenci ve öğretmen atamaya başlayın.'
                  : 'Kurum yöneticiniz sınıf atamalarınızı yaptığında burada görüntülenecek.'
              }
            />
          )
        }
      </DataView>
      <Modal
        open={edit !== undefined}
        onOpenChange={(v) => {
          if (!v) setEdit(undefined);
        }}
        title={edit ? 'Sınıfı düzenle' : 'Yeni sınıf'}
      >
        <Editor
          onSave={async (f) => {
            await api('classes' + (edit ? '/' + edit.id : ''), edit ? 'PATCH' : 'POST', {
              name: text(f, 'name'),
              description: text(f, 'description'),
            });
            setEdit(undefined);
            r.refresh();
            router.refresh();
          }}
        >
          <Field label="Sınıf adı">
            <Input name="name" required defaultValue={edit?.name} minLength={2} />
          </Field>
          <Field label="Açıklama">
            <textarea
              name="description"
              className="input"
              defaultValue={edit?.description}
              rows={3}
            />
          </Field>
        </Editor>
        {edit && (
          <div className="section-divider">
            <h3>Öğretmen atamaları</h3>
            {edit.teachers.map((t) => (
              <div className="assignment-person" key={t.id}>
                <div>
                  <strong>
                    {t.teacher.user.firstName} {t.teacher.user.lastName}
                  </strong>
                  <p>{t.subject.name}</p>
                </div>
                <Confirm
                  title="Öğretmen ataması kaldırılsın mı?"
                  label="Kaldır"
                  variant="outline"
                  onConfirm={async () => {
                    await api('teacher-assignments', 'DELETE', {
                      teacherId: t.teacherId,
                      classId: edit.id,
                      subjectId: t.subjectId,
                    });
                    setEdit(undefined);
                    r.refresh();
                    router.refresh();
                  }}
                >
                  İlgili aktif ders programı varsa önce programdan kaldırmanız gerekir.
                </Confirm>
              </div>
            ))}
            <Editor
              submit="Öğretmen ata"
              onSave={async (f) => {
                await api('teacher-assignments', 'POST', {
                  classId: edit.id,
                  teacherId: text(f, 'teacherId'),
                  subjectId: text(f, 'subjectId'),
                });
                setEdit(undefined);
                r.refresh();
                router.refresh();
              }}
            >
              <Field label="Öğretmen">
                <Select name="teacherId" required>
                  <option value="">Öğretmen seçin</option>
                  {meta.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.firstName} {t.user.lastName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Ders">
                <Select name="subjectId" required>
                  <option value="">Ders seçin</option>
                  {meta.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </Editor>
          </div>
        )}
      </Modal>
      <Modal
        wide
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected('');
        }}
        title={meta.classes.find((c) => c.id === selected)?.name + ' · Öğrenci listesi'}
      >
        {selected && <UsersPage actor={actor} meta={meta} fixedClass={selected} />}
      </Modal>
    </>
  );
}
