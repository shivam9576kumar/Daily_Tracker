import type { DailyChallengeMeta, Rating, Task } from '../../types';
import { useTodoStore } from '../../store/todoStore';
import { useUIStore } from '../../store/uiStore';
import { getErrorMessage } from '../../services/api';
import TodoTaskRow from './TodoTaskRow';
import './todo.css';

interface Props {
  meta: DailyChallengeMeta;
  onOpenTask: (task: Task) => void;
  onToggleSolved: (task: Task) => void;
  onRate: (task: Task, rating: Rating) => void;
  onUnrate: (task: Task) => void;
  busy?: string | null;
}

export default function DailyChallengesSection({
  meta, onOpenTask, onToggleSolved, onRate, onUnrate, busy,
}: Props) {
  const { data } = useTodoStore();
  const toast = useUIStore((s) => s.toast);
  const { cp31OneMore, cp31Skip, cp31AdvanceBand } = useTodoStore();

  if (!data) return null;

  const { cp31 } = meta;
  const cp31Tasks = data.today.cp31 || [];

  // Don't render anything if CP31 is not enabled
  if (!cp31.enabled || !cp31.band) return null;

  const isBandComplete = cp31.bandStatus === 'complete-awaiting-confirm';
  const progressPct = cp31.bandSize > 0
    ? Math.round((cp31.solvedInBand / cp31.bandSize) * 100)
    : 0;

  const handleOneMore = async () => {
    try {
      await cp31OneMore();
      toast('One more problem served!', 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const handleSkip = async (task: Task) => {
    try {
      await cp31Skip(task.id);
      toast('Problem skipped — ladder advanced', 'info');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  const handleAdvance = async () => {
    try {
      await cp31AdvanceBand();
      toast(`Advanced to Band ${(cp31.band ?? 0) + 100}!`, 'success');
    } catch (err) {
      toast(getErrorMessage(err), 'error');
    }
  };

  return (
    <section className="cp31-section">
      {/* Header */}
      <div className="cp31-section__header">
        <div className="cp31-section__title-row">
          <span className="cp31-section__icon" aria-hidden="true">⚔️</span>
          <h2 className="cp31-section__title">CP31 · Band {cp31.band}</h2>
          <span className="cp31-section__progress-text">
            {cp31.solvedInBand}/{cp31.bandSize}
          </span>
        </div>
        <div className="cp31-section__progress-bar">
          <div
            className="cp31-section__progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Band Complete Celebration */}
      {isBandComplete ? (
        <div className="cp31-band-complete">
          <div className="cp31-band-complete__trophy" aria-hidden="true">🏆</div>
          <h3 className="cp31-band-complete__title">
            Band {cp31.band} Complete!
          </h3>
          <p className="cp31-band-complete__sub">
            {cp31.solvedInBand} problems solved. Ready for the next challenge?
          </p>
          <div className="cp31-band-complete__actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void handleAdvance()}
            >
              Start Band {(cp31.band ?? 0) + 100}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Task list */}
          {cp31Tasks.length > 0 && (
            <div className="todo-task-list">
              {cp31Tasks.map((t) => (
                <TodoTaskRow
                  key={t.id}
                  task={t}
                  busy={busy === t.id}
                  onOpen={onOpenTask}
                  onToggleSolved={onToggleSolved}
                  onRate={onRate}
                  onUnrate={onUnrate}
                  onSkip={
                    t.taskType === 'cp31' && t.status === 'pending'
                      ? handleSkip
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {cp31Tasks.length === 0 && !cp31.quotaDoneToday && (
            <p className="cp31-section__empty">
              No CP31 tasks for today. All caught up!
            </p>
          )}

          {/* One More Button */}
          {cp31.quotaDoneToday && (
            <div className="cp31-one-more">
              <button
                type="button"
                className={`cp31-one-more__btn${cp31.extrasUsedToday >= cp31.extrasCap ? ' is-capped' : ''}`}
                disabled={cp31.extrasUsedToday >= cp31.extrasCap}
                onClick={() => void handleOneMore()}
              >
                {cp31.extrasUsedToday >= cp31.extrasCap
                  ? '✓ Great session — come back tomorrow'
                  : `+ One More (${cp31.extrasUsedToday}/${cp31.extrasCap})`}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
