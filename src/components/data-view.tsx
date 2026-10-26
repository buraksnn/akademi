'use client';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loading, Failure, Modal } from './ui/common';
import { Button } from './ui/button';
export function DataView<T>({
  resource,
  children,
}: {
  resource: { data?: T; error: string; loading: boolean; refresh: () => void };
  children: (v: T) => ReactNode;
}) {
  return resource.error ? (
    <Failure error={resource.error} retry={resource.refresh} />
  ) : !resource.data ? (
    <Loading />
  ) : (
    <>{children(resource.data)}</>
  );
}
export function Editor({
  title,
  description,
  children,
  onSave,
  submit = 'Kaydet',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  onSave: (form: FormData) => Promise<void>;
  submit?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        try {
          await onSave(data);
          toast.success('İşlem tamamlandı.');
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {title && <h3>{title}</h3>}
      {description && <p className="muted">{description}</p>}
      {children}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>
          {busy ? 'Kaydediliyor…' : submit}
        </Button>
      </div>
    </form>
  );
}
export function Confirm({
  title,
  children,
  onConfirm,
  label = 'Sil',
  variant = 'destructive',
}: {
  title: string;
  children: ReactNode;
  onConfirm: () => Promise<void>;
  label?: string;
  variant?: 'destructive' | 'outline';
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title={title}
        description="Bu işlemin etkisini kontrol edip onaylayın."
      >
        <p>{children}</p>
        <div className="form-actions">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Vazgeç
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
                toast.success('İşlem tamamlandı.');
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'İşleniyor…' : 'Onayla'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
export const text = (f: FormData, key: string) => String(f.get(key) || '');
export function PageTitle({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
