import { useEffect, type ReactNode } from 'react';
import './common.css';

interface Props {
  open: boolean;
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Drawer({
  open,
  onClose,
  header,
  children,
  footer,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="task-panel-overlay drawer-overlay" onClick={onClose} />
      <aside className="task-panel drawer" aria-modal="true" role="dialog">
        {header}
        <div className="task-panel__body drawer-body">{children}</div>
        {footer && <div className="task-panel__foot drawer-footer">{footer}</div>}
      </aside>
    </>
  );
}
