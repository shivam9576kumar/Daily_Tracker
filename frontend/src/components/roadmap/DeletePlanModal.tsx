import Modal from '../common/Modal';
import Button from '../common/Button';
import type { Plan, Task } from '../../types';
import './roadmap.css';

interface Props {
  open: boolean;
  plan: Plan | null;
  tasks: Task[];
  revisions: Task[];
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeletePlanModal({ open, plan, tasks, revisions, busy, onClose, onConfirm }: Props) {
  if (!plan) return null;

  const pendingProblems = tasks.filter(t => t.status !== 'completed').length;
  const pendingRevs = revisions.filter(r => r.status !== 'completed' && r.planId === plan.id).length;
  const solvedKept = tasks.filter(t => t.status === 'completed').length + revisions.filter(r => r.status === 'completed' && r.planId === plan.id).length;

  return (
    <Modal
      open={open}
      title={`Delete "${plan.name}"?`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>Permanently Delete</Button>
        </>
      }
    >
      <div style={{ fontSize: 13.5, color: '#9ca3af' }}>
        This cannot be undone.
      </div>

      <div className="delete-counts">
        <div>Will <span className="delete-warn"><strong>remove</strong></span>:</div>
        <div>• <strong>{pendingProblems}</strong> pending problems from Roadmap & hitlist</div>
        <div>• <strong>{pendingRevs}</strong> scheduled revisions</div>
        <div style={{ marginTop: 8 }}>Will <span className="delete-keep"><strong>keep</strong></span> as history:</div>
        <div>• <strong>{solvedKept}</strong> solved problems [heatmap, streak, coins unchanged]</div>
        <div style={{ marginTop: 8, fontSize: 12, color: '#8b90a0' }}>
          Assignments, manually added tasks, classes, and notes on solved problems are not affected.
        </div>
      </div>
    </Modal>
  );
}
