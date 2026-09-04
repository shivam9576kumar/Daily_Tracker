import { useCallback, useEffect, useMemo, useState } from 'react';
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
      <div className="classes-page">
        <Spinner large />
      </div>
    );

  return (
    <div className="classes-page">
      <header className="classes-page__header">
        <div className="classes-page__title-row">
          <span className="classes-page__icon" aria-hidden="true">📚</span>
          <h1 className="classes-page__title">My Classes</h1>
        </div>
        <p className="classes-page__subtitle">
          Enter your semester timetable once. It appears live on your dashboard each day.
        </p>
      </header>

      <datalist id="subject-list">
        {subjects.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <section className="card class-editor">
        <div className="class-editor__head">
          <div className="class-editor__head-left">
            <h2 className="class-editor__heading">Weekly Timetable</h2>
            <span className="pill pill-count">
              {rows.length} {rows.length === 1 ? 'class' : 'classes'}
            </span>
          </div>
          {dirty && <span className="pill pill-warning">Unsaved changes</span>}
        </div>

        <div className="class-editor__body">
          {rows.length === 0 ? (
            <div className="class-editor__empty">
              <span className="class-editor__empty-icon" aria-hidden="true">📚</span>
              <h3 className="class-editor__empty-title">No classes yet</h3>
              <p className="class-editor__empty-hint">
                Add your first class to see it on the Dashboard each day.
              </p>
              <button type="button" className="btn-brand-outline" onClick={addRow}>
                + Add Class
              </button>
            </div>
          ) : (
            <>
              <div className="class-editor__labels" aria-hidden="true">
                <span>Day</span>
                <span>Subject</span>
                <span>Start</span>
                <span>End</span>
                <span>Room</span>
                <span />
              </div>

              {rows.map((row, i) => (
                <div key={row.key} className="class-editor__row">
                  <div className="cell">
                    <label className="cell__label">Day</label>
                    <div className="select-wrap">
                      <select
                        className="field"
                        value={row.dayOfWeek}
                        onChange={(e) => setRow(i, { dayOfWeek: Number(e.target.value) })}
                      >
                        {DAY_NAMES.map((d, di) => (
                          <option key={di} value={di}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="cell cell--subject">
                    <label className="cell__label">Subject</label>
                    <input
                      className="field"
                      list="subject-list"
                      placeholder="e.g. CS201 Data Structures"
                      value={row.subject}
                      onChange={(e) => setRow(i, { subject: e.target.value })}
                    />
                  </div>

                  <div className="cell">
                    <label className="cell__label">Start</label>
                    <div className="select-wrap">
                      <select
                        className="field"
                        value={row.startTime}
                        onChange={(e) => onStartChange(i, e.target.value)}
                      >
                        {[...new Set([...HOURS, row.startTime])].sort().map((t) => (
                          <option key={t} value={t}>
                            {to12h(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="cell">
                    <label className="cell__label">End</label>
                    <div className="select-wrap">
                      <select
                        className="field"
                        value={row.endTime}
                        onChange={(e) => setRow(i, { endTime: e.target.value })}
                      >
                        {[...new Set([...HOURS, ...HOURS.map((t) => addMinutesToHHMM(t, 55)), row.endTime])]
                          .sort()
                          .map((t) => (
                            <option key={t} value={t}>
                              {to12h(t)}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="cell">
                    <label className="cell__label">Room</label>
                    <input
                      className="field"
                      placeholder="Room"
                      value={row.location ?? ''}
                      onChange={(e) => setRow(i, { location: e.target.value })}
                    />
                  </div>

                  <div className="cell cell--remove">
                    <button
                      type="button"
                      className="icon-btn is-danger"
                      aria-label="Remove class"
                      onClick={() => removeRow(i)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="class-editor__foot">
          <div className="class-editor__foot-left">
            <button type="button" className="btn-brand-outline" onClick={addRow}>
              + Add Class
            </button>
            <div className="copy-day">
              <span className="copy-day__label">Copy day:</span>
              <div className="select-wrap select-wrap--sm">
                <select
                  className="field field--sm"
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
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? 'Saving...' : 'Save Timetable'}
          </button>
        </div>
      </section>

      <p className="classes-footnote">
        Saved once per semester. Cancel-for-today lives on the dashboard.
      </p>
    </div>
  );
}
