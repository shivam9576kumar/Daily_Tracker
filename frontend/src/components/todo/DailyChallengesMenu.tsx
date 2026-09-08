import { useEffect, useRef, useState } from 'react';
import { useDailyChallengesStore } from '../../store/dailyChallengesStore';
import './todo.css';

export default function DailyChallengesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { settings, loading, saving, error, fetch, setPotdEnabled } = useDailyChallengesStore();

  useEffect(() => {
    if (open && !settings && !loading) void fetch();
  }, [open, settings, loading, fetch]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const potdOn = settings?.potdEnabled ?? true;

  return (
    <div className="dc-menu" ref={ref}>
      <button
        type="button"
        className="btn-secondary btn-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Daily challenges"
        onClick={() => setOpen((o) => !o)}
      >
        ⚡ Daily
      </button>

      {open && (
        <div className="dc-menu__panel" role="dialog" aria-label="Daily challenges">
          <div className="dc-menu__title">Daily challenges</div>

          <div className="dc-row">
            <div className="dc-row__text">
              <span className="dc-row__name">LeetCode POTD</span>
              <span className="dc-row__desc">
                {potdOn ? 'One LeetCode problem a day, added to Today.' : 'Off — today’s challenge is hidden.'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={potdOn}
              aria-label="Toggle LeetCode POTD"
              className={`dc-switch${potdOn ? ' is-on' : ''}`}
              disabled={loading || saving}
              onClick={() => void setPotdEnabled(!potdOn)}
            >
              <span className="dc-switch__thumb" aria-hidden="true" />
            </button>
          </div>

          {error && <p className="dc-menu__error">{error}</p>}
          <p className="dc-menu__note">
            Turning off removes today’s pending challenge. Solved history, coins and streak are kept.
          </p>
        </div>
      )}
    </div>
  );
}
