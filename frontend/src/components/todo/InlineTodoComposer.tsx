import { useEffect, useRef, useState } from 'react';
import TodoDatePicker from './TodoDatePicker';
import { todoApi } from '../../services/todoApi';
import { getErrorMessage } from '../../services/api';
import { useTodoStore } from '../../store/todoStore';
import { useUIStore } from '../../store/uiStore';
import { dateChipLabel } from '../../utils/todoDates';
import './todo.css';

const MAX_TITLE = 200;

interface Props {
  /** Prefilled schedule for this context; null = Inbox. */
  defaultDateKey: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export default function InlineTodoComposer({
  defaultDateKey, open, onOpen, onClose,
}: Props) {
  const toast = useUIStore((s) => s.toast);
  const fetchTodo = useTodoStore((s) => s.fetch);

  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState<string | null>(defaultDateKey);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Re-sync default when the composer opens in a new context
  useEffect(() => {
    if (open) {
      setDateKey(defaultDateKey);
      setErrorText('');
      // focus after paint
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open, defaultDateKey]);

  const trimmed = title.trim();
  const tooLong = trimmed.length > MAX_TITLE;
  const canSubmit = trimmed.length > 0 && !tooLong && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorText('');
    try {
      await todoApi.createPersonal({ title: trimmed, scheduledDateKey: dateKey });
      setTitle('');
      toast(dateKey === null ? 'Added to Inbox' : `Added for ${dateChipLabel(dateKey)}`, 'success');
      await fetchTodo(true);
      inputRef.current?.focus(); // stay open for rapid entry
    } catch (err) {
      setErrorText(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="todo-composer-trigger" onClick={onOpen}>
        <span className="todo-composer-trigger__plus" aria-hidden="true">+</span>
        Add task
      </button>
    );
  }

  return (
    <div className="todo-composer">
      <input
        ref={inputRef}
        className="todo-composer__input"
        placeholder="What do you need to do?"
        value={title}
        maxLength={MAX_TITLE + 50}
        disabled={submitting}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === 'Escape') onClose();
        }}
      />

      {(tooLong || errorText) && (
        <p className="todo-composer__error">
          {tooLong ? `Title must be under ${MAX_TITLE} characters` : errorText}
        </p>
      )}

      <div className="todo-composer__bar">
        <div className="todo-composer__chip-wrap">
          <button
            type="button"
            className={`todo-composer__chip${dateKey !== null ? ' is-set' : ''}`}
            disabled={submitting}
            onClick={() => setPickerOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
          >
            <span aria-hidden="true">🗓</span> {dateChipLabel(dateKey)}
          </button>

          {pickerOpen && (
            <TodoDatePicker
              value={dateKey}
              onSelect={(k) => { setDateKey(k); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}
        </div>

        <div className="todo-composer__actions">
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={submitting}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            {submitting ? 'Adding…' : 'Add task'}
          </button>
        </div>
      </div>

      <p className="todo-composer__note">
        Personal task — for DSA problems use “+ DSA Problem” above.
      </p>
    </div>
  );
}
