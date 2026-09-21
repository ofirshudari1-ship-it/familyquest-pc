import type { ReactNode } from 'react';
import { useModalA11y } from '../hooks/useModalA11y';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  danger = false,
  onConfirm,
  onCancel,
  children
}: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const panelRef = useModalA11y<HTMLDivElement>(onCancel);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20,20,30,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fq-confirm-title"
        style={{
          background: 'var(--surface, #fff)',
          borderRadius: 14,
          padding: 24,
          width: 360,
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="fq-confirm-title" style={{ margin: '0 0 8px' }}>{title}</h3>
        {message && <p style={{ margin: '0 0 16px', color: 'var(--text-dim, #666)' }}>{message}</p>}
        {children && <div style={{ marginBottom: 16 }}>{children}</div>}
        {/* DOM order is confirm-then-cancel on purpose: the document is dir="rtl",
            and with justify-content:flex-end a row flex container lays its main
            axis right-to-left, so the FIRST child ends up rightmost. Windows'
            own RTL dialogs put the primary/default action on the right (verified
            against File Explorer) — putting confirm first here is what achieves
            that, not what breaks it. Swapping this order flips the buttons back
            to the wrong (mirrored-English) layout. */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onConfirm}
            data-fq-autofocus={danger ? undefined : 'true'}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              color: '#fff',
              background: danger ? 'var(--bad, #d64545)' : 'var(--primary, #4834a3)',
              fontWeight: 600
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            data-fq-autofocus={danger ? 'true' : undefined}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
