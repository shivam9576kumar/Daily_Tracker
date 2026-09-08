import { useEffect, useRef, useState } from 'react';
import { quickDateOptions, isPastKey } from '../../utils/todoDates';
import { todayKey } from '../../utils/dateKeys';
import './todo.css';

interface Props {
  value: string | null;
  onSelect: (dateKey: string | null) => void;
  onClose: () => void;
}

export default function TodoDatePicker({ value, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [customError, setCustomError] = useState('');

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const options = quickDateOptions();

  const handleCustom = (raw: string) => {
    if (!raw) return;
    if (isPastKey(raw)) {
      setCustomError('Pick today or a future date');
      return;
    }
    setCustomError('');
    onSelect(raw);
  };

  return (
    <div className="todo-datepicker" ref={ref} role="dialog" aria-label="Set date">
      <ul className="todo-datepicker__list">
        {options.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              className={`todo-datepicker__option${value === opt.dateKey ? ' is-active' : ''}`}
              onClick={() => onSelect(opt.dateKey)}
            >
              <span>{opt.label}</span>
              <span className="todo-datepicker__hint">{opt.hint}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="todo-datepicker__custom">
        <label className="todo-datepicker__custom-label" htmlFor="todo-custom-date">
          Custom date
        </label>
        <input
          id="todo-custom-date"
          type="date"
          className="field field--sm"
          min={todayKey()}
          defaultValue={value ?? ''}
          onChange={(e) => handleCustom(e.target.value)}
        />
        {customError && <p className="todo-datepicker__error">{customError}</p>}
      </div>
    </div>
  );
}
