import { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { taskApi } from '../../services/taskApi';
import { getErrorMessage } from '../../services/api';
import { useUIStore } from '../../store/uiStore';
import type { Difficulty } from '../../types';
import '../common/common.css';

const TOPICS = [
  'Arrays',
  'Strings',
  'Hashing',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Linked List',
  'Stack',
  'Queue',
  'Recursion',
  'Backtracking',
  'Trees',
  'BST',
  'Heap',
  'Graphs',
  'Dynamic Programming',
  'Greedy',
  'Tries',
  'Bit Manipulation',
  'Math',
];

const PLATFORMS = [
  'leetcode',
  'coderarmy',
  'striver',
  'neetcode',
  'gfg',
  'custom',
];

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function AddTaskModal({ open, onClose, onCreated }: Props) {
  const toast = useUIStore((s) => s.toast);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('Arrays');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [platform, setPlatform] = useState('leetcode');
  const [problemUrl, setProblemUrl] = useState('');
  const [scheduledDate, setScheduledDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setTopic('Arrays');
    setDifficulty('medium');
    setPlatform('leetcode');
    setProblemUrl('');
    setScheduledDate(todayStr());
    setError('');
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await taskApi.create({
        title: title.trim(),
        topic,
        difficulty,
        platform,
        problemUrl: problemUrl.trim() || undefined,
        scheduledDate,
      });
      toast('Task created', 'success');
      reset();
      onCreated();
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
      title="Add New Task"
      onClose={close}
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Create Task
          </Button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label>Problem Title *</label>
        <input
          className="form-input"
          value={title}
          autoFocus
          placeholder="e.g. Two Sum"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Topic</label>
          <select
            className="form-select"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Difficulty</label>
          <select
            className="form-select"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Platform</label>
          <select
            className="form-select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Scheduled Date</label>
          <input
            type="date"
            className="form-input"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Problem URL (optional)</label>
        <input
          className="form-input"
          value={problemUrl}
          placeholder="https://leetcode.com/problems/two-sum/"
          onChange={(e) => setProblemUrl(e.target.value)}
        />
      </div>
    </Modal>
  );
}
