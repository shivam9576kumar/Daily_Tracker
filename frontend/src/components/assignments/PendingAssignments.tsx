import { useState } from 'react';
import type { Assignment } from '../../types';
import { assignmentApi } from '../../services/assignmentApi';
import { getErrorMessage } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import Button from '../common/Button';
import AssignmentItem from './AssignmentItem';
import AssignmentForm from './AssignmentForm';
import './assignments.css';

interface Props {
  pending: Assignment[];
  onChanged: () => void;
}

export default function PendingAssignments({ pending, onChanged }: Props) {
  const toast = useUIStore((s) => s.toast);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [completed, setCompleted] = useState<Assignment[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (a: Assignment) => {
    setEditing(a);
    setFormOpen(true);
  };

  const toggle = async (a: Assignment) => {
    setBusyId(a.id);
    try {
      if (a.status === 'completed') await assignmentApi.reopen(a.id);
      else await assignmentApi.complete(a.id);
      toast(a.status === 'completed' ? 'Assignment reopened' : 'Assignment done', 'success');
      onChanged();
      if (showCompleted) await loadCompleted();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (a: Assignment) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    setBusyId(a.id);
    try {
      await assignmentApi.remove(a.id);
      toast('Assignment deleted', 'info');
      onChanged();
      if (showCompleted) await loadCompleted();
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const loadCompleted = async () => {
    try {
      const all = await assignmentApi.getAll();
      setCompleted(all.filter((x) => x.status === 'completed'));
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const toggleCompleted = async () => {
    const next = !showCompleted;
    setShowCompleted(next);
    if (next) await loadCompleted();
  };

  return (
    <section className="card assignments-card">
      <div className="assignments-header">
        <h2 className="t-h2">📌 Pending Assignments</h2>
        <span className="pill pill-count">{pending.length}</span>
        <div className="assignments-spacer" />
        <button type="button" className="t-link" onClick={openCreate}>
          + Add
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="assignments-empty t-body">No pending college assignments. Nice.</div>
      ) : (
        pending.map((a) => (
          <AssignmentItem
            key={a.id}
            assignment={a}
            busy={busyId === a.id}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={remove}
          />
        ))
      )}

      <button type="button" className="t-link assignments-toggle" onClick={toggleCompleted}>
        {showCompleted ? 'Hide completed' : 'Show completed'}
      </button>

      {showCompleted &&
        completed.map((a) => (
          <AssignmentItem
            key={a.id}
            assignment={a}
            busy={busyId === a.id}
            onToggle={toggle}
            onEdit={openEdit}
            onDelete={remove}
          />
        ))}

      <AssignmentForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={onChanged}
      />
    </section>
  );
}
