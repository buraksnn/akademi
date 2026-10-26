'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ArrowUpRight } from 'lucide-react';
import { api, useResource } from '@/lib/client';
import { dateText, today } from '@/lib/time';
import type { Exams, Results, Meta, Users } from './types';
import { PageTitle, DataView, Editor, text } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Empty, Modal, Badge } from './ui/common';
import { ResultChart } from './overview';
export function ResultsPage() {
  const r = useResource<Results>('results'),
    [type, setType] = useState('ALL');
  return (
    <>
      <PageTitle
        title="Deneme Sonuçlarım"
        description="Ders bazında netlerini ve zaman içindeki gelişimini incele."
      />
      <DataView resource={r}>
        {(results) => (
          <>
            <ResultChart results={results} />
            <section className="panel results-history">
              <div className="panel-heading">
                <div>
                  <h2>Sınav geçmişi</h2>
                  <p>Net = Doğru − Yanlış / 4</p>
                </div>
                <Select
                  aria-label="Sınav türü filtresi"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="ALL">Tüm sınavlar</option>
                  <option>TYT</option>
                  <option>AYT</option>
                </Select>
              </div>
              {results.filter((r) => type === 'ALL' || r.exam.template.type === type).length ? (
                results
                  .filter((r) => type === 'ALL' || r.exam.template.type === type)
                  .slice()
                  .reverse()
                  .map((row) => {
                    const previous = results
                      .filter(
                        (r) =>
                          r.exam.template.type === row.exam.template.type &&
                          r.exam.date < row.exam.date,
                      )
                      .at(-1);
                    return (
                      <details className="exam-detail" key={row.id}>
                        <summary>
                          <span>
                            <Badge>{row.exam.template.type}</Badge>
                            <strong>{row.exam.name}</strong>
                            <small>{dateText(row.exam.date)}</small>
                          </span>
                          <span>
                            <strong>{Number(row.totalNet).toLocaleString('tr-TR')} net</strong>
                            {previous && (
                              <small
                                className={
                                  row.totalNet >= previous.totalNet ? 'positive' : 'negative'
                                }
                              >
                                {row.totalNet >= previous.totalNet ? '+' : ''}
                                {(row.totalNet - previous.totalNet).toLocaleString('tr-TR')} önceki
                                denemeye göre
                              </small>
                            )}
                          </span>
                        </summary>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Ders</th>
                                <th>Doğru</th>
                                <th>Yanlış</th>
                                <th>Boş</th>
                                <th>Net</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.subjects.map((s) => (
                                <tr key={s.id}>
                                  <td>{s.templateSubject.subject.name}</td>
                                  <td>{s.correct}</td>
                                  <td>{s.wrong}</td>
                                  <td>{s.blank}</td>
                                  <td>
                                    <strong>{s.net.toLocaleString('tr-TR')}</strong>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })
              ) : (
                <Empty
                  title="Henüz deneme sonucunuz bulunmuyor."
                  description="Sonuçlarınız kurumunuz tarafından eklendiğinde burada görüntülenecek."
                />
              )}
            </section>
          </>
        )}
      </DataView>
    </>
  );
}
function ResultEntry({ exam, onSaved }: { exam: Exams[number]; onSaved: () => void }) {
  const [classId, setClass] = useState(exam.classes[0]?.classId || ''),
    [q, setQ] = useState(''),
    [page, setPage] = useState(1),
    [student, setStudent] = useState('');
  const students = useResource<Users>(
      'users?' +
        new URLSearchParams({ classId, role: 'STUDENT', status: 'active', q, page: String(page) }),
    ),
    existing = useResource<Results>('results?studentId=' + student);
  const result = existing.data?.find((v) => v.examId === exam.id);
  return (
    <>
      <div className="form-grid">
        <Field label="Sınıf">
          <Select
            value={classId}
            onChange={(e) => {
              setClass(e.target.value);
              setStudent('');
              setPage(1);
            }}
          >
            {exam.classes.map((c) => (
              <option key={c.id} value={c.classId}>
                {c.class.name}
              </option>
            ))}
          </Select>
        </Field>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(text(new FormData(e.currentTarget), 'q'));
            setPage(1);
          }}
        >
          <Field label="Öğrenci ara">
            <div className="inline-form">
              <Input name="q" placeholder="Ad veya öğrenci no" />
              <Button variant="outline" type="submit">
                Ara
              </Button>
            </div>
          </Field>
        </form>
      </div>
      <DataView resource={students}>
        {(data) => (
          <>
            <Field label="Öğrenci">
              <Select value={student} onChange={(e) => setStudent(e.target.value)}>
                <option value="">Öğrenci seçin</option>
                {data.items.map((u) => (
                  <option key={u.id} value={u.student!.id}>
                    {u.student!.number} · {u.firstName} {u.lastName}
                  </option>
                ))}
              </Select>
            </Field>
            {data.total > 20 && (
              <div className="pagination">
                <span>{data.total} öğrenci</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Önceki
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Sonraki
                </Button>
              </div>
            )}
          </>
        )}
      </DataView>
      {student && (
        <DataView resource={existing}>
          {() => (
            <Editor
              key={student + '-' + (result?.updatedAt || 'new')}
              submit="Sonucu kaydet"
              onSave={async (f) => {
                await api('results', 'POST', {
                  examId: exam.id,
                  studentId: student,
                  subjects: exam.template.subjects.map((s) => ({
                    templateSubjectId: s.id,
                    correct: Number(text(f, s.id + '-c')),
                    wrong: Number(text(f, s.id + '-w')),
                    blank: Number(text(f, s.id + '-b')),
                  })),
                });
                existing.refresh();
                onSaved();
              }}
            >
              <div className="table-scroll">
                <table className="result-entry">
                  <thead>
                    <tr>
                      <th>Ders / soru</th>
                      <th>Doğru</th>
                      <th>Yanlış</th>
                      <th>Boş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.template.subjects.map((s) => {
                      const current = result?.subjects.find((r) => r.templateSubjectId === s.id);
                      return (
                        <tr key={s.id}>
                          <td>
                            {s.subject.name}
                            <small className="block muted">{s.questionCount} soru</small>
                          </td>
                          {[
                            ['c', current?.correct ?? 0],
                            ['w', current?.wrong ?? 0],
                            ['b', current?.blank ?? s.questionCount],
                          ].map(([suffix, value]) => (
                            <td key={suffix}>
                              <Input
                                aria-label={
                                  s.subject.name +
                                  ' ' +
                                  { c: 'Doğru', w: 'Yanlış', b: 'Boş' }[suffix as 'c']
                                }
                                name={s.id + '-' + suffix}
                                type="number"
                                min={0}
                                max={s.questionCount}
                                required
                                defaultValue={value}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="field-hint">
                Doğru + yanlış + boş toplamı dersin soru sayısını aşamaz. Netler sunucuda
                hesaplanır.
              </p>
            </Editor>
          )}
        </DataView>
      )}
    </>
  );
}
export function ExamsPage({ meta }: { meta: Meta }) {
  const r = useResource<Exams>('exams'),
    router = useRouter(),
    [edit, setEdit] = useState<Exams[number] | null>(),
    [entry, setEntry] = useState<Exams[number]>(),
    [template, setTemplate] = useState(false);
  return (
    <>
      <PageTitle
        title="Deneme sınavları"
        description="TYT ve AYT denemelerini oluşturun, öğrenci sonuçlarını kaydedin."
        action={
          <div className="button-group">
            <Button variant="outline" onClick={() => setTemplate(true)}>
              Şablon oluştur
            </Button>
            <Button onClick={() => setEdit(null)}>
              <Plus size={16} />
              Deneme oluştur
            </Button>
          </div>
        }
      />
      <DataView resource={r}>
        {(items) =>
          items.length ? (
            <section className="panel">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Deneme</th>
                      <th>Tarih</th>
                      <th>Sınıflar</th>
                      <th>Sonuç</th>
                      <th>Durum</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <strong>{e.name}</strong>
                          <small className="block muted">{e.template.name}</small>
                        </td>
                        <td>{dateText(e.date)}</td>
                        <td>{e.classes.map((c) => c.class.name).join(', ')}</td>
                        <td>{e._count.results} öğrenci</td>
                        <td>
                          <Badge tone={e.status === 'PUBLISHED' ? 'green' : 'neutral'}>
                            {e.status === 'PUBLISHED' ? 'Yayında' : 'Taslak'}
                          </Badge>
                        </td>
                        <td>
                          <div className="button-group">
                            <Button variant="ghost" size="sm" onClick={() => setEdit(e)}>
                              Düzenle
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEntry(e)}>
                              Sonuç gir <ArrowUpRight size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <Empty
              title="Henüz deneme sınavı bulunmuyor."
              description="Önce bir soru şablonu, ardından bu şablonla bir deneme oluşturun."
            />
          )
        }
      </DataView>
      <Modal
        open={edit !== undefined}
        onOpenChange={(v) => {
          if (!v) setEdit(undefined);
        }}
        title={edit ? 'Denemeyi düzenle' : 'Deneme oluştur'}
      >
        <Editor
          onSave={async (f) => {
            await api('exams' + (edit ? '/' + edit.id : ''), edit ? 'PATCH' : 'POST', {
              name: text(f, 'name'),
              templateId: text(f, 'templateId'),
              date: text(f, 'date'),
              description: text(f, 'description'),
              status: text(f, 'status'),
              classIds: f.getAll('classIds'),
            });
            setEdit(undefined);
            r.refresh();
          }}
        >
          <Field label="Sınav adı">
            <Input name="name" required minLength={2} defaultValue={edit?.name} />
          </Field>
          <div className="form-grid">
            <Field label="Soru şablonu">
              <Select name="templateId" required defaultValue={edit?.templateId}>
                <option value="">Şablon seçin</option>
                {meta.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.type})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tarih">
              <Input
                type="date"
                name="date"
                required
                defaultValue={edit?.date.slice(0, 10) || today()}
              />
            </Field>
          </div>
          <Field label="Açıklama">
            <textarea
              className="input"
              name="description"
              defaultValue={edit?.description}
              rows={3}
            />
          </Field>
          <Field label="Durum">
            <Select name="status" defaultValue={edit?.status || 'DRAFT'}>
              <option value="DRAFT">Taslak</option>
              <option value="PUBLISHED">Yayında</option>
            </Select>
          </Field>
          <fieldset className="checkbox-list">
            <legend>İlgili sınıflar</legend>
            {meta.classes.map((c) => (
              <label className="checkbox-label" key={c.id}>
                <input
                  type="checkbox"
                  name="classIds"
                  value={c.id}
                  defaultChecked={edit?.classes.some((t) => t.classId === c.id)}
                />
                {c.name}
              </label>
            ))}
          </fieldset>
        </Editor>
      </Modal>
      <Modal
        wide
        open={!!entry}
        onOpenChange={(v) => {
          if (!v) setEntry(undefined);
        }}
        title={entry?.name + ' · Sonuç girişi'}
      >
        {entry && <ResultEntry exam={entry} onSaved={r.refresh} />}
      </Modal>
      <Modal open={template} onOpenChange={setTemplate} title="Sınav şablonu oluştur">
        <Editor
          onSave={async (f) => {
            await api('templates', 'POST', {
              name: text(f, 'name'),
              type: text(f, 'type'),
              subjects: meta.subjects
                .filter((s) => Number(text(f, s.id)) > 0)
                .map((s) => ({ subjectId: s.id, questionCount: Number(text(f, s.id)) })),
            });
            setTemplate(false);
            router.refresh();
          }}
        >
          <Field label="Şablon adı">
            <Input name="name" required minLength={2} placeholder="Örn. AYT Sayısal" />
          </Field>
          <Field label="Sınav türü">
            <Select name="type">
              <option>TYT</option>
              <option>AYT</option>
            </Select>
          </Field>
          <p className="field-hint">
            Şablona dahil edilecek derslerin soru sayısını girin. 0 girilen dersler dahil edilmez.
          </p>
          {meta.subjects.map((s) => (
            <Field label={s.name} key={s.id}>
              <Input type="number" name={s.id} min={0} max={200} defaultValue={0} />
            </Field>
          ))}
        </Editor>
      </Modal>
    </>
  );
}
