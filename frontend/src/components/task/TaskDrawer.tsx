import { useState, useEffect } from 'react';
import { useTaskStore } from '../../store/taskStore';
import { taskApi } from '../../services/taskApi';
import '../dashboard/dashboard.css';

interface Props {
  onUpdate: () => void;
}

export default function TaskDrawer({ onUpdate }: Props) {
  const {
    selectedTask, isDrawerOpen, isRatingModalOpen,
    closeDrawer, openRatingModal, closeRatingModal,
  } = useTaskStore();

  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load notes when task changes
  useEffect(() => {
    if (selectedTask) {
      setNotes(selectedTask.notes || '');
      setNotesSaved(true);
    }
  }, [selectedTask]);

  if (!selectedTask) return null;

  const isCompleted = selectedTask.status === 'completed';
  const isNewTask = selectedTask.taskType === 'new';
  const isRevision = selectedTask.taskType === 'revision';

  const handleSaveNotes = async () => {
    setIsProcessing(true);
    try {
      await taskApi.saveNotes(selectedTask.id, notes);
      setNotesSaved(true);
    } catch (err) {
      console.error('Failed to save notes:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkDone = () => {
    if (isNewTask) {
      openRatingModal();
    } else {
      // Revision tasks: just complete, no rating
      handleComplete();
    }
  };

  const handleComplete = async (rating?: string) => {
    setIsProcessing(true);
    try {
      await taskApi.complete(selectedTask.id, rating);
      closeRatingModal();
      closeDrawer();
      onUpdate();
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRerate = async (rating: string) => {
    setIsProcessing(true);
    try {
      await taskApi.rate(selectedTask.id, rating);
      closeDrawer();
      onUpdate();
    } catch (err) {
      console.error('Failed to re-rate:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndo = async () => {
    setIsProcessing(true);
    try {
      await taskApi.undo(selectedTask.id);
      closeDrawer();
      onUpdate();
    } catch (err) {
      console.error('Failed to undo:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <>
      {/* Overlay */}
      <div
        className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div className={`drawer ${isDrawerOpen ? 'open' : ''}`} id="task-drawer">
        <div className="drawer-header">
          <h3 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
            Task Details
          </h3>
          <button className="drawer-close" onClick={closeDrawer} id="drawer-close">×</button>
        </div>

        <div className="drawer-body">
          {/* Task Info */}
          <div className="drawer-section">
            <h4 style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 'var(--font-weight-bold)',
              marginBottom: 'var(--space-2)',
            }}>
              {selectedTask.title}
            </h4>
            <div className="drawer-meta">
              <div className="drawer-meta__item">
                <div className="drawer-meta__label">Topic</div>
                <div className="drawer-meta__value">{selectedTask.topic}</div>
              </div>
              <div className="drawer-meta__item">
                <div className="drawer-meta__label">Difficulty</div>
                <div className="drawer-meta__value" style={{
                  color: selectedTask.difficulty === 'easy' ? 'var(--color-success)' :
                         selectedTask.difficulty === 'medium' ? 'var(--color-warning)' :
                         'var(--color-danger)',
                }}>
                  {selectedTask.difficulty}
                </div>
              </div>
              <div className="drawer-meta__item">
                <div className="drawer-meta__label">Scheduled</div>
                <div className="drawer-meta__value">{formatDate(selectedTask.scheduledDate)}</div>
              </div>
              <div className="drawer-meta__item">
                <div className="drawer-meta__label">Platform</div>
                <div className="drawer-meta__value">{selectedTask.platform}</div>
              </div>
              {isRevision && selectedTask.originalSolveDate && (
                <div className="drawer-meta__item">
                  <div className="drawer-meta__label">Original Solve</div>
                  <div className="drawer-meta__value">{formatDate(selectedTask.originalSolveDate)}</div>
                </div>
              )}
              {isCompleted && (
                <>
                  <div className="drawer-meta__item">
                    <div className="drawer-meta__label">Completed</div>
                    <div className="drawer-meta__value">{formatDate(selectedTask.completedAt)}</div>
                  </div>
                  {selectedTask.rating && (
                    <div className="drawer-meta__item">
                      <div className="drawer-meta__label">Rating</div>
                      <div className="drawer-meta__value">{selectedTask.rating}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Solve Link */}
          {selectedTask.problemUrl && (
            <div className="drawer-section">
              <a
                href={selectedTask.problemUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-full"
                id="solve-link"
              >
                🔗 Solve on {selectedTask.platform}
              </a>
            </div>
          )}

          {/* Notes */}
          <div className="drawer-section">
            <div className="drawer-section__title">📝 Notes</div>
            <textarea
              className="notes-textarea"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
              placeholder="Add your notes here..."
              id="notes-textarea"
            />
            <button
              className={`btn ${notesSaved ? 'btn-secondary' : 'btn-primary'} btn-full`}
              onClick={handleSaveNotes}
              disabled={notesSaved || isProcessing}
              id="save-notes-btn"
            >
              {notesSaved ? '✏️ Edit Notes' : '💾 Save Notes'}
            </button>
          </div>

          {/* Actions */}
          <div className="drawer-section" style={{ marginTop: 'auto' }}>
            {!isCompleted && (
              <button
                className="btn btn-primary btn-full"
                onClick={handleMarkDone}
                disabled={isProcessing}
                id="mark-done-btn"
              >
                {isProcessing ? 'Processing...' : '✅ Mark as Done'}
              </button>
            )}

            {isCompleted && isNewTask && (
              <>
                <div className="drawer-section__title">Change Rating</div>
                <div className="rating-buttons">
                  <button className="rating-btn rating-btn--easy" onClick={() => handleRerate('easy')}>✅ Easy</button>
                  <button className="rating-btn rating-btn--medium" onClick={() => handleRerate('medium')}>⚡ Medium</button>
                  <button className="rating-btn rating-btn--hard" onClick={() => handleRerate('hard')}>🔥 Hard</button>
                </div>
              </>
            )}

            {isCompleted && (
              <button
                className="btn btn-danger btn-full"
                onClick={handleUndo}
                disabled={isProcessing}
                id="undo-btn"
                style={{ marginTop: 'var(--space-2)' }}
              >
                ↩️ Undo (Mark as Pending)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rating Modal */}
      {isRatingModalOpen && (
        <div className="rating-modal-overlay" onClick={closeRatingModal}>
          <div className="rating-modal" onClick={(e) => e.stopPropagation()} id="rating-modal">
            <h3>How did it go?</h3>
            <p>Rate your performance to generate the right revision schedule</p>
            <div className="rating-buttons">
              <button className="rating-btn rating-btn--easy" onClick={() => handleComplete('easy')}>
                ✅ Easy
              </button>
              <button className="rating-btn rating-btn--medium" onClick={() => handleComplete('medium')}>
                ⚡ Medium
              </button>
              <button className="rating-btn rating-btn--hard" onClick={() => handleComplete('hard')}>
                🔥 Hard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
