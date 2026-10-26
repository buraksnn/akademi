'use client';
import { useState } from 'react';
import { Plus, Check, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { api, useResource } from '@/lib/client';
import { dateText, dateTimeToUtc } from '@/lib/time';
import type { Assignments, Meta, CurrentUser } from './types';
import { PageTitle, DataView, Editor, text, Confirm } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Empty, Modal, Badge } from './ui/common';
export function AssignmentsPage({ actor, meta }: { actor: CurrentUser; meta: Meta }) {
  const r = useResource<Assignments>('assignments'),
    [filter, setFilter] = useState('all'),
    [edit, setEdit] = useState<Assignments[number] | null>(),
    [detail, setDetail] = useState<Assignments[number]>(),
    student = actor.role === 'STUDENT';
  const [busy, setBusy] = useState('');
  const status = (a: Assignments[number]) =>
    student && a.statuses[0]?.completedAt
      ? 'done'
      : new Date(a.dueAt) < new Date()
        ? 'late'
        : 'pending';
  return (
    <>
      <PageTitle
        title={student ? 'Ödevlerim' : 'Ödevler'}
        description={
          student
            ? 'Yapılacaklarını planla, tamamladıklarını işaretle.'
            : 'Ödev atayın ve öğrencilerin tamamlama durumlarını takip edin.'
        }
        action={
          !student && (
            <Button onClick={() => setEdit(null)}>
              <Plus size={16} />
              Ödev oluştur
            </Button>
          )
        }
      />
      <div className="tab-strip">
        {[
          ['all', 'Tümü'],
          ['pending', 'Bekliyor'],
          ['late', 'Gecikti'],
          ...(student ? [['done', 'Tamamlandı']] : []),
        ].map(([v, l]) => (
          <button key={v} className={filter === v ? 'active' : ''} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>
      <DataView resource={r}>
        {(rows) => {
          const items = rows.filter((a) => filter === 'all' || status(a) === filter);
          return items.length ? (
            <section className="panel">
              {items.map((a) => (
                <article className="assignment-row" key={a.id}>
                  {student && (
                    <button
                      aria-label={
                        status(a) === 'done'
                          ? 'Ödevi bekliyor olarak işaretle'
                          : 'Ödevi tamamlandı olarak işaretle'
                      }
                      disabled={busy === a.id}
                      className={'complete-button ' + (status(a) === 'done' ? 'checked' : '')}
                      onClick={async () => {
                        setBusy(a.id);
                        try {
                          await api('assignments/' + a.id + '/complete', 'POST', {
                            completed: !a.statuses[0]?.completedAt,
                          });
                          r.refresh();
                          toast.success('Ödev durumu güncellendi.');
                        } catch (e) {
                          toast.error((e as Error).message);
                        } finally {
                          setBusy('');
                        }
                      }}
                    >
                      {status(a) === 'done' && <Check size={15} />}
                    </button>
                  )}
                  <div className="assignment-main">
                    <button className="title-button" onClick={() => setDetail(a)}>
                      {a.title}
                    </button>
                    <p>{a.description.slice(0, 150)}</p>
                    <div className="assignment-meta">
                      <Badge>{a.subject.name}</Badge>
                      {!student && <span>{a.class.name}</span>}
                      <span>
                        <CalendarDays size={13} />
                        {dateText(a.dueAt)}
                      </span>
                    </div>
                  </div>
                  <div className="assignment-side">
                    <Badge
                      tone={
                        status(a) === 'done' ? 'green' : status(a) === 'late' ? 'red' : 'neutral'
                      }
                    >
                      {{ done: 'Tamamlandı', late: 'Gecikti', pending: 'Bekliyor' }[status(a)]}
                    </Badge>
                    {!student && (
                      <>
                        <small>
                          {a.statuses.filter((v) => v.completedAt).length} öğrenci tamamladı
                        </small>
                        <Button variant="ghost" size="sm" onClick={() => setEdit(a)}>
                          Düzenle
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <Empty
              title="Bu görünümde ödev bulunmuyor."
              description={
                student
                  ? 'Kurumunuzun atadığı ödevler burada görüntülenecek.'
                  : 'Yeni bir ödev oluşturarak sınıfınıza atayabilirsiniz.'
              }
            />
          );
        }}
      </DataView>
      <Modal
        open={edit !== undefined}
        onOpenChange={(v) => {
          if (!v) setEdit(undefined);
        }}
        title={edit ? 'Ödevi düzenle' : 'Ödev oluştur'}
      >
        <Editor
          onSave={async (f) => {
            await api('assignments' + (edit ? '/' + edit.id : ''), edit ? 'PATCH' : 'POST', {
              title: text(f, 'title'),
              description: text(f, 'description'),
              subjectId: text(f, 'subjectId'),
              classId: text(f, 'classId'),
              dueAt: dateTimeToUtc(text(f, 'dueAt'), meta.settings.timezone),
            });
            setEdit(undefined);
            r.refresh();
          }}
        >
          <Field label="Ödev başlığı">
            <Input name="title" required minLength={2} maxLength={200} defaultValue={edit?.title} />
          </Field>
          <Field label="Açıklama">
            <textarea
              name="description"
              className="input"
              rows={4}
              maxLength={5000}
              defaultValue={edit?.description}
            />
          </Field>
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
          </div>
          <Field label="Son teslim tarihi" hint={'Kurum saat dilimi: ' + meta.settings.timezone}>
            <Input
              name="dueAt"
              type="datetime-local"
              required
              defaultValue={
                edit
                  ? new Intl.DateTimeFormat('sv-SE', {
                      timeZone: meta.settings.timezone,
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                    })
                      .format(new Date(edit.dueAt))
                      .replace(' ', 'T')
                  : undefined
              }
            />
          </Field>
        </Editor>
        {edit && (
          <div className="section-divider">
            <Confirm
              title="Ödev silinsin mi?"
              onConfirm={async () => {
                await api('assignments/' + edit.id, 'DELETE');
                setEdit(undefined);
                r.refresh();
              }}
            >
              Ödev ve öğrenci tamamlama kayıtları silinecek.
            </Confirm>
          </div>
        )}
      </Modal>
      <Modal
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(undefined);
        }}
        title={detail?.title || 'Ödev'}
      >
        {detail && (
          <>
            <p className="preserve-lines">{detail.description || 'Açıklama eklenmemiş.'}</p>
            <p className="muted">
              {detail.subject.name} · {dateText(detail.dueAt)}
            </p>
            {!student && <AssignmentRoster assignment={detail} />}
          </>
        )}
      </Modal>
    </>
  );
}

type AssignmentRosterRow = {
  id: string;
  number: number;
  user: { firstName: string; lastName: string };
  assignmentStatuses: { completedAt: string | null }[];
};
function AssignmentRoster({ assignment }: { assignment: Assignments[number] }) {
  const r = useResource<AssignmentRosterRow[]>('assignments/' + assignment.id + '/students');
  return (
    <div className="section-divider">
      <h3>Öğrenci tamamlama durumları</h3>
      <DataView resource={r}>
        {(rows) =>
          rows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Öğrenci</th>
                    <th>Numara</th>
                    <th>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.user.firstName} {s.user.lastName}
                      </td>
                      <td>{s.number}</td>
                      <td>
                        <Badge tone={s.assignmentStatuses[0]?.completedAt ? 'green' : 'neutral'}>
                          {s.assignmentStatuses[0]?.completedAt
                            ? 'Tamamlandı'
                            : new Date(assignment.dueAt) < new Date()
                              ? 'Gecikti'
                              : 'Bekliyor'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Sınıfta aktif öğrenci bulunmuyor." />
          )
        }
      </DataView>
    </div>
  );
}
