'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Inbox, Loader2, AlertCircle } from 'lucide-react';
import { Button, cn } from './button';
import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={cn('dialog-content', wide && 'wide')}>
          <div className="dialog-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {description || 'Bilgileri inceleyin ve işleminizi tamamlayın.'}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Kapat">
                <X size={19} />
              </Button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('input', props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('input', props.className)} />;
}
export function Empty({
  title = 'Henüz kayıt bulunmuyor.',
  description = 'Kayıtlar eklendiğinde burada görüntülenecek.',
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={22} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Loading() {
  return (
    <div aria-label="Yükleniyor" aria-busy="true" className="loading">
      <Loader2 className="spin" size={20} />
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
    </div>
  );
}
export function Failure({ error, retry }: { error: string; retry: () => void }) {
  return (
    <div className="empty" role="alert">
      <AlertCircle size={24} />
      <h3>Bilgiler yüklenemedi.</h3>
      <p>{error}</p>
      <Button variant="outline" onClick={retry}>
        Tekrar dene
      </Button>
    </div>
  );
}
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={cn('badge', tone)}>{children}</span>;
}
