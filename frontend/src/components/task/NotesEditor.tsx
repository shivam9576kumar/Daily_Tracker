import { useEffect, useRef, useState } from 'react';
import { notesApi } from '../../services/notesApi';
import { getErrorMessage } from '../../services/api';
import { useDebounce } from '../../hooks/useDebounce';
import './task.css';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Props {
  taskId: string;
  initialContent: string;
}

export default function NotesEditor({ taskId, initialContent }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const debounced = useDebounce(content, 800);
  const lastSaved = useRef(initialContent);
  const skipFirst = useRef(true);

  // If user opens a different task, reset local state
  useEffect(() => {
    setContent(initialContent);
    lastSaved.current = initialContent;
    setSaveState('idle');
    setError('');
    skipFirst.current = true;
  }, [taskId, initialContent]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (debounced === lastSaved.current) return;

    let cancelled = false;
    setSaveState('saving');
    setError('');

    notesApi
      .upsert(taskId, debounced)
      .then(() => {
        if (cancelled) return;
        lastSaved.current = debounced;
        setSaveState('saved');
      })
      .catch((err) => {
        if (cancelled) return;
        setSaveState('error');
        setError(getErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, taskId]);

  const label =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
      ? 'Saved'
      : saveState === 'error'
      ? error || 'Could not save'
      : 'Autosaves as you type';

  return (
    <section className="notes">
      <div className="notes__head">
        <span className="notes__title">📝 Notes</span>
        <span
          className={`notes__hint${
            saveState === 'saved'
              ? ' is-saved'
              : saveState === 'error'
              ? ' is-error'
              : ''
          }`}
        >
          {label}
        </span>
      </div>
      <textarea
        className="field notes__input"
        value={content}
        placeholder="Approach, pitfalls, complexity, what to revise…"
        onChange={(e) => {
          setContent(e.target.value);
          if (saveState === 'saved') setSaveState('idle');
        }}
        maxLength={20000}
        rows={4}
      />
    </section>
  );
}
