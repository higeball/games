import { useEffect, useRef, type ReactNode } from "react";

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const active = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => {
      document.body.style.overflow = overflow;
      if (active?.isConnected) active.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="app-confirm"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section>
        <h2>{title}</h2>
        <div className="confirmation-body">{children}</div>
        <div className="confirmation-actions">
          <button autoFocus onClick={onClose}>
            戻る
          </button>
          <button className="primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </dialog>
  );
}
