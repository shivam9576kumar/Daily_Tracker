import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TodoSidebar, { type TodoCounts, type TodoView } from '../components/todo/TodoSidebar';
import TodoHeader from '../components/todo/TodoHeader';
import TodoSection from '../components/todo/TodoSection';
import TodoTaskRow from '../components/todo/TodoTaskRow';
import TodoAssignmentRow from '../components/todo/TodoAssignmentRow';
import TodoCompletedSection from '../components/todo/TodoCompletedSection';
import TodoEmpty from '../components/todo/TodoEmpty';
import TaskDrawer from '../components/task/TaskDrawer';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { assignmentApi } from '../services/assignmentApi';
import { getErrorMessage } from '../services/api';
import { useTaskActions } from '../hooks/useTaskActions';
import { useTodoStore } from '../store/todoStore';
import { useUIStore } from '../store/uiStore';
import { formatKey } from '../utils/dateKeys';
import type { Assignment, Task, TodoDateGroup } from '../types';
import '../components/todo/todo.css';

const VALID_VIEWS: TodoView[] = ['inbox', 'today', 'upcoming', 'backlog', 'completed'];

const VIEW_META: Record<TodoView, { title: string; description: string }> = {
  inbox: { title: 'Inbox', description: 'Unscheduled personal tasks will live here.' },
  today: { title: 'Today', description: 'Everything that needs your attention today.' },
  upcoming: { title: 'Upcoming', description: 'Your scheduled work for the next 14 days.' },
  backlog: { title: 'Backlog', description: 'Overdue work that still needs to be completed.' },
  completed: { title: 'Completed', description: 'Your recently completed work.' },
};

function isTodoView(v: string | null): v is TodoView {
  return v !== null && VALID_VIEWS.includes(v as TodoView);
}

function groupTitle(g: TodoDateGroup): string {
  return g.label === 'Today' || g.label === 'Tomorrow' || g.label === 'Yesterday'
    ? g.label
    : formatKey(g.dateKey);
}

export default function TodoPage() {
  const toast = useUIStore((s) => s.toast);
  const { data, loading, error, fetch } = useTodoStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assignmentBusyId, setAssignmentBusyId] = useState<string | null>(null);

  const requested = searchParams.get('view');
  const activeView: TodoView = isTodoView(requested) ? requested : 'today';

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const refresh = useCallback(() => fetch(true), [fetch]);
  const actions = useTaskActions(refresh);

  const setActiveView = useCallback(
    (view: TodoView) => setSearchParams({ view }, { replace: true }),
    [setSearchParams]
  );

  const handleAssignmentToggle = useCallback(
    async (a: Assignment) => {
      if (assignmentBusyId) return;
      setAssignmentBusyId(a.id);
      try {
        if (a.status === 'completed') {
          await assignmentApi.reopen(a.id);
          toast('Assignment reopened', 'info');
        } else {
          await assignmentApi.complete(a.id);
          toast('Assignment completed', 'success');
        }
        await fetch(true);
      } catch (err) {
        toast(getErrorMessage(err), 'error');
      } finally {
        setAssignmentBusyId(null);
      }
    },
    [assignmentBusyId, fetch, toast]
  );

  // ── all hooks above ──

  if (loading && !data) {
    return <div className="todo-loading"><Spinner large /></div>;
  }

  if (error && !data) {
    return (
      <div className="todo-load-error">
        <span className="todo-load-error__icon" aria-hidden="true">⚠️</span>
        <h1 className="t-h2">Unable to load Todo</h1>
        <p className="t-body">{error}</p>
        <Button onClick={() => void fetch()}>Retry</Button>
      </div>
    );
  }

  if (!data) return null;

  const counts: TodoCounts = {
    inbox: data.summary.inbox,
    today: data.summary.today,
    upcoming: data.summary.upcoming,
    backlog: data.summary.backlog,
    completed: data.completed.reduce((n, g) => n + g.tasks.length + g.assignments.length, 0),
  };

  const renderTasks = (tasks: Task[]) => (
    <div className="todo-task-list">
      {tasks.map((t) => (
        <TodoTaskRow
          key={t.id}
          task={t}
          busy={actions.busyId === t.id}
          onOpen={(sel) => setSelectedTaskId(sel.id)}
          onToggleSolved={actions.toggleSolved}
          onRate={actions.rate}
          onUnrate={actions.unrate}
        />
      ))}
    </div>
  );

  const renderAssignments = (items: Assignment[]) => (
    <div className="todo-task-list">
      {items.map((a) => (
        <TodoAssignmentRow
          key={a.id}
          assignment={a}
          busy={assignmentBusyId === a.id}
          onToggle={handleAssignmentToggle}
        />
      ))}
    </div>
  );

  const renderDateGroups = (groups: TodoDateGroup[], noun: string) =>
    groups.map((g) => (
      <section key={g.dateKey} className="todo-date-group">
        <div className="todo-date-group__header">
          <h2>{groupTitle(g)}</h2>
          <span>{g.tasks.length + g.assignments.length} {noun}</span>
        </div>
        {renderTasks(g.tasks)}
        {renderAssignments(g.assignments)}
      </section>
    ));

  const t = data.today;
  const todayPendingTotal =
    t.backlog.length + t.plan.length + t.potd.length + t.revisions.length + t.manual.length;
  const meta = VIEW_META[activeView];
  const headerDescription =
    activeView === 'today' ? `${formatKey(data.todayKey)} · ${meta.description}` : meta.description;

  return (
    <div className="todo-page">
      <TodoSidebar activeView={activeView} counts={counts} onChange={setActiveView} />

      <main className="todo-main">
        <TodoHeader title={meta.title} description={headerDescription} />

        {error && (
          <div className="todo-inline-error" role="status">
            Some data could not be refreshed: {error}
          </div>
        )}

        {activeView === 'inbox' && (
          <TodoEmpty
            icon="📥"
            title="No inbox tasks yet"
            description="Personal task capture will be added in Part 5."
          />
        )}

        {activeView === 'today' && (
          <div className="todo-view">
            <TodoSection title="Overdue / Backlog" count={t.backlog.length} tone="warning">
              {renderTasks(t.backlog)}
            </TodoSection>
            <TodoSection title="Today’s Study Plan" count={t.plan.length}>
              {renderTasks(t.plan)}
            </TodoSection>
            <TodoSection title="Daily Challenge" count={t.potd.length} tone="brand">
              {renderTasks(t.potd)}
            </TodoSection>
            <TodoSection title="Revisions Due" count={t.revisions.length}>
              {renderTasks(t.revisions)}
            </TodoSection>
            <TodoSection title="Manual DSA Tasks" count={t.manual.length}>
              {renderTasks(t.manual)}
            </TodoSection>
            <TodoSection title="Assignments Due" count={t.assignments.length} tone="warning">
              {renderAssignments(t.assignments)}
            </TodoSection>

            {todayPendingTotal === 0 && t.assignments.length === 0 && t.completed.length === 0 && (
              <TodoEmpty icon="🌤️" title="Nothing due today" description="Your study list is clear for today." />
            )}

            <TodoCompletedSection count={t.completed.length}>
              {renderTasks(t.completed)}
            </TodoCompletedSection>
          </div>
        )}

        {activeView === 'upcoming' && (
          <div className="todo-view">
            {data.upcoming.length === 0 ? (
              <TodoEmpty icon="📆" title="No upcoming work" description="Nothing is currently scheduled in the next 14 days." />
            ) : (
              renderDateGroups(data.upcoming, 'items')
            )}
          </div>
        )}

        {activeView === 'backlog' && (
          <div className="todo-view">
            {data.backlog.length === 0 ? (
              <TodoEmpty icon="✅" title="Backlog is clear" description="You have no overdue study tasks." />
            ) : (
              <TodoSection title="Needs Attention" count={data.backlog.length} tone="warning">
                {renderTasks(data.backlog)}
              </TodoSection>
            )}
          </div>
        )}

        {activeView === 'completed' && (
          <div className="todo-view">
            {data.completed.length === 0 ? (
              <TodoEmpty icon="🕊️" title="No recent completions" description="Completed work from the last seven days will appear here." />
            ) : (
              renderDateGroups(data.completed, 'completed')
            )}
          </div>
        )}
      </main>

      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
