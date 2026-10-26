'use client';
import { useState } from 'react';
import { Plus, Megaphone } from 'lucide-react';
import { api, useResource } from '@/lib/client';
import { dateText } from '@/lib/time';
import type { Announcements, Meta, CurrentUser } from './types';
import { PageTitle, DataView, Editor, text, Confirm } from './data-view';
import { Button } from './ui/button';
import { Field, Input, Select, Empty, Modal, Badge } from './ui/common';
export function AnnouncementsPage({ actor, meta }: { actor: CurrentUser; meta: Meta }) {
  const r = useResource<Announcements>('announcements'),
    [edit, setEdit] = useState<Announcements[number] | null>(),
    [audience, setAudience] = useState('ALL'),
    admin = actor.role === 'ADMIN';
  return (
    <>
      <PageTitle
        title="Duyurular"
        description="Kurumdan haberler, hatırlatmalar ve önemli tarihler."
        action={
          admin && (
            <Button
              onClick={() => {
                setEdit(null);
                setAudience('ALL');
              }}
            >
              <Plus size={16} />
              Duyuru yayınla
            </Button>
          )
        }
      />
      <DataView resource={r}>
        {(items) =>
          items.length ? (
            <div className="announcement-feed">
              {items.map((a) => (
                <article key={a.id} className="panel announcement-card">
                  <div className="announcement-card-header">
                    <span className="announcement-icon">
                      <Megaphone size={18} />
                    </span>
                    <span>{dateText(a.publishedAt)}</span>
                    {admin && (
                      <Badge>
                        {
                          {
                            ALL: 'Tüm kullanıcılar',
                            STUDENTS: 'Öğrenciler',
                            TEACHERS: 'Öğretmenler',
                            CLASSES: a.targets.map((t) => t.class.name).join(', '),
                          }[a.audience]
                        }
                      </Badge>
                    )}
                  </div>
                  <h2>{a.title}</h2>
                  <p className="preserve-lines">{a.content}</p>
                  {admin && (
                    <div className="button-group">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEdit(a);
                          setAudience(a.audience);
                        }}
                      >
                        Düzenle
                      </Button>
                      <Confirm
                        title="Duyuru silinsin mi?"
                        onConfirm={async () => {
                          await api('announcements/' + a.id, 'DELETE');
                          r.refresh();
                        }}
                      >
                        Duyuru tüm alıcıların listesinden kaldırılacak.
                      </Confirm>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Henüz duyuru bulunmuyor."
              description="Kurumunuzun yayınladığı duyurular burada görüntülenecek."
            />
          )
        }
      </DataView>
      <Modal
        open={edit !== undefined}
        onOpenChange={(v) => {
          if (!v) setEdit(undefined);
        }}
        title={edit ? 'Duyuruyu düzenle' : 'Duyuru yayınla'}
      >
        <Editor
          submit={edit ? 'Değişiklikleri kaydet' : 'Yayınla'}
          onSave={async (f) => {
            await api('announcements' + (edit ? '/' + edit.id : ''), edit ? 'PATCH' : 'POST', {
              title: text(f, 'title'),
              content: text(f, 'content'),
              audience: text(f, 'audience'),
              classIds: f.getAll('classIds'),
            });
            setEdit(undefined);
            r.refresh();
          }}
        >
          <Field label="Başlık">
            <Input name="title" required minLength={2} maxLength={200} defaultValue={edit?.title} />
          </Field>
          <Field label="İçerik">
            <textarea
              name="content"
              className="input"
              rows={6}
              minLength={2}
              maxLength={10000}
              required
              defaultValue={edit?.content}
            />
          </Field>
          <Field label="Hedef kitle">
            <Select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="ALL">Tüm kullanıcılar</option>
              <option value="STUDENTS">Tüm öğrenciler</option>
              <option value="TEACHERS">Öğretmenler</option>
              <option value="CLASSES">Belirli sınıflar</option>
            </Select>
          </Field>
          {audience === 'CLASSES' && (
            <fieldset className="checkbox-list">
              <legend>Sınıflar</legend>
              {meta.classes.map((c) => (
                <label className="checkbox-label" key={c.id}>
                  <input
                    name="classIds"
                    type="checkbox"
                    value={c.id}
                    defaultChecked={edit?.targets.some((t) => t.classId === c.id)}
                  />
                  {c.name}
                </label>
              ))}
            </fieldset>
          )}
        </Editor>
      </Modal>
    </>
  );
}
