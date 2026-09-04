import Modal from '../common/Modal';
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

export default function DeletePlanModal({ open, plan, busy, onClose, onConfirm }: Props) {
  if (!plan) return null;

  return (
    <Modal
      open={open}
      title="Delete this plan?"
      onClose={onClose}
      footer={
        <div className="modal__footer">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn-danger" onClick={onConfirm} disabled={busy}>
            Delete plan
          </button>
        </div>
      }
    >
      <p className="t-body">This removes the plan and unfinished problems.</p>
      <ul className="modal__list">
        <li>Pending unsolved plan problems are removed</li>
        <li>Solved history, coins and streak are kept</li>
        <li>Already scheduled revisions are kept</li>
      </ul>
    </Modal>
  );
}
