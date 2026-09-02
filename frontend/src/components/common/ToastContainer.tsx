import { useUIStore } from '../../store/uiStore';
import './common.css';

const ICONS = { success: '✅', error: '⚠️', info: 'ℹ️' } as const;

export default function ToastContainer() {
  const { toasts, dismiss } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => dismiss(t.id)}
        >
          <span>{ICONS[t.type]}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
