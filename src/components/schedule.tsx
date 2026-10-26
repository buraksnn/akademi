'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MapPin } from 'lucide-react';
import { api, useResource } from '@/lib/client';
import { days, clock, today, weekDay } from '@/lib/time';
import type { Schedules, Meta, CurrentUser } from './types';
import { PageTitle, DataView, Editor, text, Confirm } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Empty, Modal, Badge } from './ui/common';
export function SchedulePage({ actor, meta }: { actor: CurrentUser; meta: Meta }) {
  const r = useResource<Schedules>('schedules'),
    router = useRouter(),
    [edit, setEdit] = useState<Schedules[number] | null>(),
    [day, setDay] = useState(weekDay(today())),
    [classId, setClassId] = useState(''),
    admin = actor.role === 'ADMIN';
  const [teacher, setTeacher] = useState('');
  return (
    <>
      <PageTitle
        title={admin ? 'Ders programı' : 'Ders Programım'}
        description="Pazartesiden pazara haftalık ders akışı."
        action={
          admin && (
            <Button
              onClick={() => {
                setEdit(null);
                setTeacher('');
              }}
            >
              <Plus size={16} />
              Ders ekle
            </Button>
          )
        }
      />
      <div className="schedule-toolbar">
        <span className="muted">Haftalık program</span>
        {admin && (
          <Select
            aria-label="Sınıf filtresi"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Tüm sınıflar</option>
            {meta.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="day-tabs" role="tablist" aria-label="Haftanın günleri">
        {days.map((d, i) => (
          <button
            key={d}
            role="tab"
            aria-selected={day === i}
            className={day === i ? 'active' : ''}
            onClick={() => setDay(i)}
          >
            {d}
          </button>
        ))}
      </div>
      <DataView resource={r}>
        {(items) => {
          const filtered = items.filter((s) => !classId || s.classId === classId);
          return (
            <>
              <div className="weekly-schedule">
                {days.map((name, i) => (
                  <section key={name} className={'day-column ' + (day === i ? 'selected' : '')}>
                    <div className="day-heading">
                      <strong>{name}</strong>
                      <span>{filtered.filter((s) => s.day === i).length} ders</span>
                    </div>
                    {filtered.filter((s) => s.day === i).length ? (
                      filtered
                        .filter((s) => s.day === i)
                        .map((s) => (
                          <article className="schedule-lesson" key={s.id}>
                            <span className="schedule-time">
                              {clock(s.startMinute)} – {clock(s.endMinute)}
                            </span>
                            <h3>{s.subject.name}</h3>
                            <p>
                              {s.teacher.user.firstName} {s.teacher.user.lastName}
                            </p>
                            <div>
                              <Badge>{s.class.name}</Badge>
                              <small>
                                <MapPin size={12} />
                                {s.classroom.name}
                              </small>
                            </div>
                            {admin && (
                              <div className="schedule-actions">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEdit(s);
                                    setTeacher(s.teacherId);
                                  }}
                                >
                                  Düzenle
                                </Button>
                                <Confirm
                                  title="Ders programdan kaldırılsın mı?"
                                  label="Kaldır"
                                  variant="outline"
                                  onConfirm={async () => {
                                    await api('schedules/' + s.id, 'DELETE');
                                    r.refresh();
                                  }}
                                >
                                  Yoklama geçmişi korunur, ders haftalık programdan kaldırılır.
                                </Confirm>
                              </div>
                            )}
                          </article>
                        ))
                    ) : (
                      <div className="day-empty">Ders yok</div>
                    )}
                  </section>
                ))}
              </div>
              {!items.length && (
                <Empty
                  title="Henüz ders programı bulunmuyor."
                  description={
                    admin
                      ? 'Ders, derslik ve öğretmen atamalarını tamamlayarak program oluşturun.'
                      : 'Program kurumunuz tarafından eklendiğinde burada görüntülenecek.'
                  }
                />
              )}
            </>
          );
        }}
      </DataView>
      <Modal
        open={edit !== undefined}
        onOpenChange={(v) => {
          if (!v) setEdit(undefined);
        }}
        title={edit ? 'Dersi düzenle' : 'Ders ekle'}
      >
        <Editor
          onSave={async (f) => {
            const minute = (v: string) => Number(v.split(':')[0]) * 60 + Number(v.split(':')[1]);
            await api('schedules' + (edit ? '/' + edit.id : ''), edit ? 'PATCH' : 'POST', {
              classId: text(f, 'classId'),
              teacherId: text(f, 'teacherId'),
              subjectId: text(f, 'subjectId'),
              classroomId: text(f, 'classroomId'),
              day: Number(text(f, 'day')),
              startMinute: minute(text(f, 'start')),
              endMinute: minute(text(f, 'end')),
            });
            setEdit(undefined);
            r.refresh();
            router.refresh();
          }}
        >
          <p className="field-hint">
            Öğretmenin ilgili sınıf ve derse atanmış olması gerekir. Çakışan dersler kaydedilmez.
          </p>
          <div className="form-grid">
            <Field label="Sınıf">
              <Select name="classId" required defaultValue={edit?.classId}>
                <option value="">Seçin</option>
                {meta.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ders">
              <Select name="subjectId" required defaultValue={edit?.subjectId}>
                <option value="">Seçin</option>
                {meta.subjects.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Öğretmen">
              <Select
                name="teacherId"
                required
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
              >
                <option value="">Seçin</option>
                {meta.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.user.firstName} {t.user.lastName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Derslik">
              <Select name="classroomId" required defaultValue={edit?.classroomId}>
                <option value="">Seçin</option>
                {meta.rooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Gün">
              <Select name="day" defaultValue={edit?.day ?? day}>
                {days.map((d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <div />
            <Field label="Başlangıç">
              <Input
                type="time"
                name="start"
                defaultValue={clock(edit?.startMinute ?? 540)}
                required
              />
            </Field>
            <Field label="Bitiş">
              <Input type="time" name="end" defaultValue={clock(edit?.endMinute ?? 580)} required />
            </Field>
          </div>
        </Editor>
      </Modal>
    </>
  );
}
