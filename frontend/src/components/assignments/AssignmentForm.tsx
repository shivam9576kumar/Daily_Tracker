import { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { assignmentApi } from '../../services/assignmentApi';
import { getErrorMessage } from '../../services/api';
import type { Assignment } from '../../types';
import '../common/common.css';

function toInputDate(iso?: string) {
  if (!iso) {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  return new Date(iso).toISOString().split('T')[0];
}

interface Props {
  open: boolean;
  editing: Assignment | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AssignmentForm({ open, editing, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(toInputDate());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title || '');
    setDescription(editing?.description || '');
    setDeadline(toInputDate(editing?.deadline));
    setError('');
  }, [open, editing]);

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        deadline,
      };
      if (editing) await assignmentApi.update(editing.id, payload);
      else await assignmentApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={editing ? 'Edit Assignment' : 'Add Assignment'}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {editing ? 'Save' : 'Add Assignment'}
          </Button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label>Title *</label>
        <input
          className="form-input"
          value={title}
          autoFocus
          placeholder="e.g. DBMS lab report"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <div className="form-group">
        <label>Deadline *</label>
        <input
          type="date"
          className="form-input"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Description (optional)</label>
        <textarea
          className="form-input"
          rows={3}
          value={description}
          placeholder="Chapter, submission link, notes…"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
