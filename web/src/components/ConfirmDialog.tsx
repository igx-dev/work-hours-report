/**
 * 確認のダイアログ(削除など、取り消せない操作の前に出す)。
 * ブラウザ標準の confirm ではなく、画面の見た目に合わせた部品。
 * 開いた時は「やめる」に焦点を置き、Esc キーや外側を押すとやめる。
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'やめる',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {children && <div className="dialog-body">{children}</div>}
        <div className="dialog-actions">
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={danger ? 'danger-button' : 'primary'} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
