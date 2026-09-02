import { useTaskStore } from '../../store/taskStore';

interface Task {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  taskType: string;
  status: string;
  revisionNumber: number;
  isBacklog: boolean;
  isExpired: boolean;
}

interface Props {
  pendingTasks: Task[];
  completedTasks: Task[];
}

export default function TodaysHitlist({ pendingTasks, completedTasks }: Props) {
  const { openDrawer } = useTaskStore();

  const getTaskTags = (task: Task) => {
    const tags: { label: string; className: string }[] = [];

    // Type tag
    if (task.taskType === 'new') {
      tags.push({ label: 'New', className: 'tag-new' });
    } else if (task.taskType === 'revision') {
      tags.push({ label: `🔄 R${task.revisionNumber}`, className: 'tag-revision' });
    } else if (task.taskType === 'assignment') {
      tags.push({ label: '📄 Assignment', className: 'tag-assignment' });
    }

    // Status tags
    if (task.isExpired) {
      tags.push({ label: '💀 Expired', className: 'tag-expired' });
    } else if (task.isBacklog) {
      tags.push({ label: '⚠️ Backlog', className: 'tag-backlog' });
    }

    // Difficulty tag
    tags.push({ label: task.difficulty, className: `tag-${task.difficulty}` });

    return tags;
  };

  return (
    <div className="hitlist-section" id="hitlist-section">
      <div className="section-header">
        <h3 className="section-title">⚡ Today's Hitlist</h3>
        <span className="section-count">{pendingTasks.length} pending</span>
      </div>

      {pendingTasks.length === 0 && completedTasks.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__emoji">🎯</div>
          <div className="empty-state__text">
            No tasks scheduled for today. Generate a plan to get started!
          </div>
        </div>
      )}

      {/* Pending Tasks — clickable, no checkboxes */}
      {pendingTasks.map((task) => (
        <div
          key={task.id}
          className="task-row"
          onClick={() => openDrawer(task as any)}
          id={`task-${task.id}`}
        >
          <span className="task-row__title">{task.title}</span>
          <div className="task-row__tags">
            {getTaskTags(task).map((tag, i) => (
              <span key={i} className={`task-tag ${tag.className}`}>
                {tag.label}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* Completed Tasks — static check, no click action */}
      {completedTasks.length > 0 && (
        <div className="completed-section">
          <div className="section-header">
            <h3 className="section-title">✅ Completed</h3>
            <span className="section-count">{completedTasks.length}</span>
          </div>
          {completedTasks.map((task) => (
            <div
              key={task.id}
              className="task-row task-row--completed"
              onClick={() => openDrawer(task as any)}
            >
              <div className="task-check-static">✓</div>
              <span className="task-row__title">{task.title}</span>
              <div className="task-row__tags">
                {getTaskTags(task).map((tag, i) => (
                  <span key={i} className={`task-tag ${tag.className}`}>
                    {tag.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
