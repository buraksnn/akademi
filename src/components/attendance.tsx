'use client';
import { useState } from 'react';
import { api, useResource } from '@/lib/client';
import { dateText, clock, today } from '@/lib/time';
import type { Schedules, CurrentUser } from './types';
import { PageTitle, DataView, Editor } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Empty, Badge } from './ui/common';
import { Avatar } from './layout/shell';
const labels: Record<string, string> = {
  PRESENT: 'Geldi',
  ABSENT: 'Gelmedi',
  LATE: 'Geç geldi',
  EXCUSED: 'İzinli',
};
type Own = {
  id: string;
  status: string;
  session: {
    date: string;
    schedule: {
      subject: { name: string };
      class: { name: string };
      startMinute: number;
      endMinute: number;
    };
  };
}[];
type Roster = {
  students: {
    id: string;
    number: number;
    user: { id: string; firstName: string; lastName: string; photo: unknown };
  }[];
  records: { studentId: string; status: string }[];
};
function RosterForm({
  data,
  scheduleId,
  date,
  refresh,
}: {
  data: Roster;
  scheduleId: string;
  date: string;
  refresh: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      data.students.map((s) => [
        s.id,
        data.records.find((r) => r.studentId === s.id)?.status || '',
      ]),
    ),
  );
  return data.students.length ? (
    <Editor
      submit="Yoklamayı kaydet"
      onSave={async () => {
        await api('attendance', 'POST', {
          scheduleId,
          date,
          records: data.students.map((s) => ({ studentId: s.id, status: statuses[s.id] })),
        });
        refresh();
      }}
    >
      <div className="panel-heading">
        <h2>
          Sınıf listesi <Badge>{data.students.length}</Badge>
        </h2>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setStatuses(Object.fromEntries(data.students.map((s) => [s.id, 'PRESENT'])))
          }
        >
          Tümünü geldi işaretle
        </Button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Öğrenci</th>
              <th>Öğrenci no</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="person-cell">
                    <Avatar user={s.user} />
                    <strong>
                      {s.user.firstName} {s.user.lastName}
                    </strong>
                  </div>
                </td>
                <td>{s.number}</td>
                <td>
                  <Select
                    aria-label={s.user.firstName + ' yoklama durumu'}
                    required
                    value={statuses[s.id] || ''}
                    onChange={(e) => setStatuses((v) => ({ ...v, [s.id]: e.target.value }))}
                  >
                    <option value="">Durum seçin</option>
                    {Object.entries(labels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="field-hint">
        Kaydedilmiş bir yoklamayı yalnızca yönetici düzeltebilir. Değişiklikler işlem geçmişine
        kaydedilir.
      </p>
    </Editor>
  ) : (
    <Empty
      title="Bu sınıfta aktif öğrenci bulunmuyor."
      description="Öğrenci sınıf atamalarını kontrol edin."
    />
  );
}
function AttendanceRoster({ scheduleId, date }: { scheduleId: string; date: string }) {
  const r = useResource<Roster>('attendance?' + new URLSearchParams({ scheduleId, date }));
  return (
    <DataView resource={r}>
      {(d) => (
        <RosterForm
          key={scheduleId + date + JSON.stringify(d.records)}
          data={d}
          scheduleId={scheduleId}
          date={date}
          refresh={r.refresh}
        />
      )}
    </DataView>
  );
}
export function AttendancePage({ actor }: { actor: CurrentUser }) {
  const [scheduleId, setSchedule] = useState(''),
    [date, setDate] = useState(today());
  const schedules = useResource<Schedules>('schedules'),
    own = useResource<Own>(actor.role === 'STUDENT' ? 'attendance' : 'attendance?date=');
  if (actor.role === 'STUDENT')
    return (
      <>
        <PageTitle
          title="Devamsızlık"
          description="Ders bazında yoklama ve devamsızlık geçmişin."
        />
        <DataView resource={own}>
          {(rows) => (
            <>
              <div className="attendance-summary">
                {Object.entries(labels).map(([v, l]) => (
                  <div key={v}>
                    <strong>{rows.filter((r) => r.status === v).length}</strong>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              <section className="panel">
                {rows.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Ders</th>
                          <th>Saat</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td>{dateText(r.session.date)}</td>
                            <td>{r.session.schedule.subject.name}</td>
                            <td>
                              {clock(r.session.schedule.startMinute)} –{' '}
                              {clock(r.session.schedule.endMinute)}
                            </td>
                            <td>
                              <Badge
                                tone={
                                  r.status === 'ABSENT'
                                    ? 'red'
                                    : r.status === 'PRESENT'
                                      ? 'green'
                                      : 'neutral'
                                }
                              >
                                {labels[r.status]}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Henüz yoklama kaydınız bulunmuyor."
                    description="Ders yoklamaları alındığında burada görüntülenecek."
                  />
                )}
              </section>
            </>
          )}
        </DataView>
      </>
    );
  return (
    <>
      <PageTitle
        title="Yoklama"
        description="Ders oturumunu seçin ve öğrencilerin katılım durumunu kaydedin."
      />
      <section className="panel padded">
        <DataView resource={schedules}>
          {(rows) => (
            <div className="form-grid">
              <Field label="Ders oturumu">
                <Select value={scheduleId} onChange={(e) => setSchedule(e.target.value)}>
                  <option value="">Ders seçin</option>
                  {rows.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.class.name} · {s.subject.name} · {clock(s.startMinute)} (
                      {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][s.day]})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tarih">
                <Input
                  type="date"
                  value={date}
                  max={today()}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>
          )}
        </DataView>
        {scheduleId && date ? (
          <AttendanceRoster key={scheduleId + date} scheduleId={scheduleId} date={date} />
        ) : (
          <Empty
            title="Yoklama almak için bir ders seçin."
            description="Yalnızca size atanmış ders oturumlarında yoklama alabilirsiniz."
          />
        )}
      </section>
    </>
  );
}
