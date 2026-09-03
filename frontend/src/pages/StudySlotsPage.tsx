import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import { classesApi, type ClassInput } from '../services/classesApi';
import { getErrorMessage } from '../services/api';
import { useUIStore } from '../store/uiStore';
import type { ClassRow } from '../types';
import {
  DAY_NAMES,
  DAY_SHORT,
  addMinutesToHHMM,
  to12h,
} from '../utils/timeFormat';
import '../components/progress/progress.css';
import '../components/common/common.css';
import '../components/classes/classes.css';

const HOURS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 30]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return out;
})();

interface Row extends ClassInput {
  key: string; // stable React key across edits
  id?: string;
}

function rowFromServer(r: ClassRow): Row {
  return {
    key: r.id,
    id: r.id,
    dayOfWeek: r.dayOfWeek,
    subject: r.subject,
    startTime: r.startTime,
    endTime: r.endTime,
    location: r.location,
  };
}

function blankRow(): Row {
  return {
    key: `new-${Math.random().toString(36).slice(2, 10)}`,
    dayOfWeek: 1,
    subject: '',
    startTime: '09:00',
    endTime: '09:55',
    location: '',
  };
}

export default function StudySlotsPage() {
  const toast = useUIStore((s) => s.toast);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [initialRows, setInitialRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await classesApi.list();
      const mapped = list.map(rowFromServer);
      setRows(mapped.length ? mapped : [blankRow()]);
      setInitialRows(mapped);
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Dirty check — used for the Save button's enabled state
  const dirty = useMemo(() => {
    const clean = (r: Row) => ({
      dayOfWeek: r.dayOfWeek,
      subject: r.subject.trim(),
      startTime: r.startTime,
      endTime: r.endTime,
      location: (r.location ?? '').trim() || null,
    });
    const withSubject = rows.filter((r) => r.subject.trim().length > 0).map(clean);
    const original = initialRows.map(clean);
    return JSON.stringify(withSubject) !== JSON.stringify(original);
  }, [rows, initialRows]);

  const subjects = useMemo(
    () => Array.from(new Set(rows.map((r) => r.subject.trim()).filter(Boolean))).sort(),
    [rows]
  );

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const onStartChange = (i: number, startTime: string) => {
    const r = rows[i];
    // Auto-fill end if the current end is now ≤ start
    const autoEnd =
      r.endTime <= startTime ? addMinutesToHHMM(startTime, 55) : r.endTime;
    setRow(i, { startTime, endTime: autoEnd });
  };

  const addRow = () => {
    const prev = rows[rows.length - 1];
    if (!prev) return setRows([blankRow()]);
    const nextStart = addMinutesToHHMM(prev.endTime, 5);
    setRows([
      ...rows,
      {
        ...blankRow(),
        dayOfWeek: prev.dayOfWeek,
        location: prev.location,
        startTime: nextStart,
        endTime: addMinutesToHHMM(nextStart, 55),
      },
    ]);
  };

  const duplicateRow = (i: number) => {
    const src = rows[i];
    const copy: Row = {
      ...src,
      key: `new-${Math.random().toString(36).slice(2, 10)}`,
      id: undefined,
    };
    setRows([...rows.slice(0, i + 1), copy, ...rows.slice(i + 1)]);
  };

  const removeRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    setRows(next.length ? next : [blankRow()]);
  };

  const copyDay = (from: number, to: number) => {
    if (from === to) return;
    const src = rows.filter((r) => r.dayOfWeek === from && r.subject.trim());
    if (!src.length) {
      toast(`No classes on ${DAY_NAMES[from]}`, 'error');
      return;
    }
    const kept = rows.filter((r) => r.dayOfWeek !== to);
    const copied = src.map((r) => ({
      ...r,
      key: `new-${Math.random().toString(36).slice(2, 10)}`,
      id: undefined,
      dayOfWeek: to,
    }));
    setRows([...kept, ...copied]);
    toast(
      `Copied ${src.length} classes from ${DAY_SHORT[from]} to ${DAY_SHORT[to]}`,
      'success'
    );
  };

  const save = async () => {
    const payload: ClassInput[] = rows
      .filter((r) => r.subject.trim())
      .map((r) => ({
        dayOfWeek: r.dayOfWeek,
        subject: r.subject.trim(),
        startTime: r.startTime,
        endTime: r.endTime,
        location: r.location?.trim() || null,
      }));

    setSaving(true);
    try {
      const saved = await classesApi.replaceAll(payload);
      const mapped = saved.map(rowFromServer);
      setRows(mapped.length ? mapped : [blankRow()]);
      setInitialRows(mapped);
      toast(
        payload.length ? `Saved ${payload.length} classes` : 'Timetable cleared',
        'success'
      );
    } catch (e) {
      toast(getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="progress-page">
        <Spinner large />
      </div>
    );

  return (
    <div className="progress-page">
      <header className="progress-header">
        <h1 className="progress-title">📚 My Classes</h1>
        <p className="progress-subtitle">
          Enter your semester timetable once. It appears live on your dashboard each
          day.
        </p>
      </header>

      <datalist id="subject-list">
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <section className="pcard">
        {rows.map((r, i) => (
          <div
            key={r.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '130px 1fr 110px 110px 130px 72px',
              gap: 8,
              marginBottom: 8,
              alignItems: 'center',
            }}
          >
            <select
              className="form-select"
              value={r.dayOfWeek}
              onChange={(e) => setRow(i, { dayOfWeek: Number(e.target.value) })}
            >
              {DAY_NAMES.map((d, di) => (
                <option key={di} value={di}>
                  {d}
                </option>
              ))}
            </select>

            <input
              className="form-input"
              list="subject-list"
              placeholder="Subject code (e.g. CH3101)"
              value={r.subject}
              onChange={(e) => setRow(i, { subject: e.target.value })}
            />

            <select
              className="form-select"
              value={r.startTime}
              onChange={(e) => onStartChange(i, e.target.value)}
            >
              {[...new Set([...HOURS, r.startTime])].sort().map((t) => (
                <option key={t} value={t}>
                  {to12h(t)}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={r.endTime}
              onChange={(e) => setRow(i, { endTime: e.target.value })}
            >
              {[...new Set([...HOURS, ...HOURS.map((t) => addMinutesToHHMM(t, 55)), r.endTime])]
                .sort()
                .map((t) => (
                  <option key={t} value={t}>
                    {to12h(t)}
                  </option>
                ))}
            </select>

            <input
              className="form-input"
              placeholder="Room (optional)"
              value={r.location ?? ''}
              onChange={(e) => setRow(i, { location: e.target.value })}
            />

            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="cl-mini"
                type="button"
                title="Duplicate row"
                onClick={() => duplicateRow(i)}
              >
                ⧉
              </button>
              <button
                className="cl-mini"
                type="button"
                title="Delete row"
                onClick={() => removeRow(i)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 14,
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <Button size="sm" variant="secondary" onClick={addRow}>
            + Add Class
          </Button>

          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>
            Copy day:
          </span>
          <select
            className="form-select"
            style={{ width: 110, padding: '5px 8px', fontSize: 12 }}
            defaultValue=""
            onChange={(e) => {
              const [f, t] = e.target.value.split('-').map(Number);
              if (!Number.isNaN(f) && !Number.isNaN(t)) copyDay(f, t);
              e.currentTarget.value = '';
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            {DAY_SHORT.flatMap((from, fi) =>
              DAY_SHORT.map((to, ti) =>
                fi !== ti ? (
                  <option key={`${fi}-${ti}`} value={`${fi}-${ti}`}>
                    {from} → {to}
                  </option>
                ) : null
              )
            ).filter(Boolean)}
          </select>

          <div style={{ flex: 1 }} />

          <Button onClick={save} loading={saving} disabled={!dirty && !saving}>
            Save Timetable
          </Button>
        </div>
      </section>

      <p
        style={{
          fontSize: 12,
          color: '#6b7280',
          textAlign: 'center',
          marginTop: 12,
        }}
      >
        Saved once per semester. Cancel-for-today lives on the dashboard.
      </p>
    </div>
  );
}
