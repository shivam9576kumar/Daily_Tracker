import { useEffect, useRef, useState } from 'react';
import { useDailyChallengesStore } from '../../store/dailyChallengesStore';
import './todo.css';

interface Props {
  open: boolean;
  onClose: () => void;
  /** If provided, re-enabling with a known band triggers resume flow. */
  resumeBand?: number | null;
}

export default function BandPickerModal({ open, onClose, resumeBand }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { settings, loading, saving, enableCp31 } = useDailyChallengesStore();
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!open) { setPicking(false); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const bands = settings?.availableBands ?? [];

  const handleSelect = async (band: number) => {
    await enableCp31(band);
    onClose();
  };

  const handleResume = async () => {
    if (resumeBand) {
      await enableCp31(resumeBand);
      onClose();
    }
  };

  return (
    <div
      className="band-picker-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="band-picker-modal" ref={ref} role="dialog" aria-label="Select CP31 Band">
        {/* Resume Dialog */}
        {resumeBand && !picking ? (
          <>
            <div className="band-picker-modal__header">
              <h2>Resume CP31?</h2>
              <button type="button" className="band-picker-modal__close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <p className="band-picker-modal__sub">Your progress on Band {resumeBand} is saved.</p>
            <div className="band-picker-modal__resume-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={saving}
                onClick={() => void handleResume()}
              >
                Resume Band {resumeBand}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={saving}
                onClick={() => setPicking(true)}
              >
                Change Band
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="band-picker-modal__header">
              <h2>Pick a Band</h2>
              <button type="button" className="band-picker-modal__close" onClick={onClose} aria-label="Close">✕</button>
            </div>
            <p className="band-picker-modal__sub">
              Each band is 31 Codeforces problems at the chosen rating.
            </p>

            {loading ? (
              <div className="band-picker-modal__loading">Loading bands…</div>
            ) : bands.length === 0 ? (
              <div className="band-picker-modal__loading">No bands available.</div>
            ) : (
              <div className="band-picker-grid">
                {bands.map((b) => (
                  <button
                    key={b.band}
                    type="button"
                    className="band-picker-card"
                    disabled={saving}
                    onClick={() => void handleSelect(b.band)}
                  >
                    <span className="band-picker-card__rating">{b.band}</span>
                    <span className="band-picker-card__count">{b.count} problems</span>
                    <span className="band-picker-card__arrow">→</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
