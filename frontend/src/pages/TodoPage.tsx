import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import TodoSidebar, { type TodoCounts, type TodoView } from '../components/todo/TodoSidebar';
import TodoHeader from '../components/todo/TodoHeader';
import TodoSection from '../components/todo/TodoSection';
import TodoTaskRow from '../components/todo/TodoTaskRow';
import TodoAssignmentRow from '../components/todo/TodoAssignmentRow';
import TodoCompletedSection from '../components/todo/TodoCompletedSection';
import TodoEmpty from '../components/todo/TodoEmpty';
import InlineTodoComposer from '../components/todo/InlineTodoComposer';
import TodoDatePicker, { type DateSelection } from '../components/todo/TodoDatePicker';
import TaskDrawer from '../components/task/TaskDrawer';
import AddTaskModal from '../components/task/AddTaskModal';
import AssignmentForm from '../components/assignments/AssignmentForm';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { assignmentApi } from '../services/assignmentApi';
import { todoApi } from '../services/todoApi';
import { getErrorMessage } from '../services/api';
import { useTaskActions } from '../hooks/useTaskActions';
import { useTodoStore } from '../store/todoStore';
import { useUIStore } from '../store/uiStore';
import { addDaysToKey, formatKey } from '../utils/dateKeys';
import type { Assignment, Task, TodoDateGroup } from '../types';
import '../components/todo/todo.css';

const VALID_VIEWS: TodoView[] = ['inbox', 'today', 'upcoming', 'backlog', 'completed'];

const VIEW_META: Record<TodoView, { title: string; description: string }> = {
  inbox: { title: 'Inbox', description: 'Unscheduled personal tasks live here.' },
  today: { title: 'Today', description: 'Everything that needs your attention today.' },
  upcoming: { title: 'Upcoming', description: 'Your scheduled work for the coming days.' },
  backlog: { title: 'Backlog', description: 'Overdue work that still needs to be completed.' },
  completed: { title: 'Completed', description: 'Your recently completed work.' },
};

function isTodoView(v: string | null): v is TodoView {
  return v !== null && VALID_VIEWS.includes(v as TodoView);
}

function groupHeading(g: TodoDateGroup): string {
  return g.label === 'Today' || g.label === 'Tomorrow' || g.label === 'Yesterday'
    ? `${g.label} · ${formatKey(g.dateKey)}`
    : formatKey(g.dateKey);
}

export default function TodoPage() {
  const toast = useUIStore((s) => s.toast);
  const { data, loading, error, fetch, upcomingDays, setUpcomingDays } = useTodoStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assignmentBusyId, setAssignmentBusyId] = useState<string | null>(null);
  const [dsaModalOpen, setDsaModalOpen] = useState(false);
  const [assignmentFormOpen, setAssignmentFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Which composer is open: 'inbox' | 'today' | 'upcoming' | `group:${dateKey}` | null
  const [composerId, setComposerId] = useState<string | null>(null);
  const [dateTarget, setDateTarget] = useState<Task | null>(null);

  const requested = searchParams.get('view');
  const activeView: TodoView = isTodoView(requested) ? requested : 'today';

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const refresh = useCallback(() => fetch(true), [fetch]);
  const actions = useTaskActions(refresh);

  const openAssignmentCreate = useCallback(() => {
    setEditingAssignment(null);
    setAssignmentFormOpen(true);
  }, []);

  const openAssignmentEdit = useCallback((a: Assignment) => {
    setEditingAssignment(a);
    setAssignmentFormOpen(true);
  }, []);

  const handleAssignmentDelete = useCallback(
    async (a: Assignment) => {
      if (!window.confirm(`Delete "${a.title}"?`)) return;
      setAssignmentBusyId(a.id);
      try {
        await assignmentApi.remove(a.id);
        toast('Assignment deleted', 'info');
        await fetch(true);
      } catch (err) {
        toast(getErrorMessage(err), 'error');
      } finally {
        setAssignmentBusyId(null);
      }
    },
    [fetch, toast]
  );

  const setActiveView = useCallback(
    (view: TodoView) => setSearchParams({ view }, { replace: true }),
    [setSearchParams]
  );

  const openComposer = useCallback((id: string) => setComposerId(id), []);
  const closeComposer = useCallback(() => setComposerId(null), []);

  // Sidebar "+ Add Task": open active view's composer (fallback → inbox view default)
  const handleSidebarAdd = useCallback(() => {
    if (activeView === 'today') setComposerId('today');
    else if (activeView === 'upcoming') setComposerId('upcoming');
    else setComposerId('inbox');
  }, [activeView]);

  // Close any open composer when switching views
  useEffect(() => {
    setComposerId(null);
  }, [activeView]);

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

  const handleSetDate = useCallback((task: Task) => setDateTarget(task), []);

  const applyDateToTask = useCallback(
    async (selection: DateSelection) => {
      if (!dateTarget) return;
      try {
        await todoApi.updatePersonal(dateTarget.id, {
          scheduledDateKey: selection.dateKey,
          dueTime: selection.dueTime,
          durationMin: selection.durationMin,
          recurrence: selection.recurrence,
        });
        toast(selection.dateKey ? 'Task rescheduled' : 'Moved to Inbox', 'success');
        setDateTarget(null);
        await fetch(true);
      } catch (err) {
        toast(getErrorMessage(err), 'error');
      }
    },
    [dateTarget, fetch, toast]
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
          onSetDate={handleSetDate}
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
          onEdit={openAssignmentEdit}
          onDelete={handleAssignmentDelete}
        />
      ))}
    </div>
  );

  const renderDateGroups = (groups: TodoDateGroup[], noun: string, withAdd = false) =>
    groups.map((g) => (
      <section key={g.dateKey} className="todo-date-group">
        <div className="todo-date-group__header">
          <h2>{groupHeading(g)}</h2>
          <span>{g.tasks.length + g.assignments.length} {noun}</span>
        </div>
        {renderTasks(g.tasks)}
        {renderAssignments(g.assignments)}
        {withAdd && (
          <InlineTodoComposer
            defaultDateKey={g.dateKey}
            open={composerId === `group:${g.dateKey}`}
            onOpen={() => openComposer(`group:${g.dateKey}`)}
            onClose={closeComposer}
          />
        )}
      </section>
    ));

  const t = data.today;
  const todayPendingTotal =
    t.backlog.length + t.plan.length + t.potd.length + t.revisions.length + t.manual.length + t.personal.length;
  const meta = VIEW_META[activeView];
  const headerDescription =
    activeView === 'today' ? `${formatKey(data.todayKey)} · ${meta.description}` : meta.description;

  return (
    <div className="todo-page">
      <TodoSidebar
        activeView={activeView}
        counts={counts}
        onChange={setActiveView}
        onAddTask={handleSidebarAdd}
      />

      <main className="todo-main">
        <TodoHeader
          title={meta.title}
          description={headerDescription}
          action={
            <div className="todo-header__actions">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={openAssignmentCreate}
              >
                + Assignment
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setDsaModalOpen(true)}
              >
                + DSA Problem
              </button>
            </div>
          }
        />

        {error && (
          <div className="todo-inline-error" role="status">
            Some data could not be refreshed: {error}
          </div>
        )}

        {activeView === 'inbox' && (
          <div className="todo-view">
            <InlineTodoComposer
              defaultDateKey={null}
              open={composerId === 'inbox'}
              onOpen={() => openComposer('inbox')}
              onClose={closeComposer}
            />
            {data.inbox.length === 0 ? (
              <TodoEmpty
                icon="📥"
                title="Inbox is empty"
                description="Capture a task above — it stays here until you schedule it."
              />
            ) : (
              <TodoSection title="Unscheduled" count={data.inbox.length}>
                {renderTasks(data.inbox)}
              </TodoSection>
            )}
          </div>
        )}

        {activeView === 'today' && (
          <div className="todo-view">
            <InlineTodoComposer
              defaultDateKey={data.todayKey}
              open={composerId === 'today'}
              onOpen={() => openComposer('today')}
              onClose={closeComposer}
            />
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
            <TodoSection title="Personal" count={t.personal.length}>
              {renderTasks(t.personal)}
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
            <div className="todo-range" role="group" aria-label="Upcoming range">
              <button
                type="button"
                className={`todo-range__btn${upcomingDays === 14 ? ' is-active' : ''}`}
                aria-pressed={upcomingDays === 14}
                onClick={() => void setUpcomingDays(14)}
              >
                14 days
              </button>
              <button
                type="button"
                className={`todo-range__btn${upcomingDays === 30 ? ' is-active' : ''}`}
                aria-pressed={upcomingDays === 30}
                onClick={() => void setUpcomingDays(30)}
              >
                30 days
              </button>
            </div>

            <InlineTodoComposer
              defaultDateKey={addDaysToKey(data.todayKey, 1)}
              open={composerId === 'upcoming'}
              onOpen={() => openComposer('upcoming')}
              onClose={closeComposer}
            />

            {data.upcoming.length === 0 ? (
              <TodoEmpty
                icon="📆"
                title="No upcoming work"
                description={`Nothing is currently scheduled in the next ${data.upcomingDays} days.`}
              />
            ) : (
              renderDateGroups(data.upcoming, 'items', true)
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
              <TodoEmpty
                icon="🕊️"
                title="No recent completions"
                description="Completed work from the last seven days will appear here."
              />
            ) : (
              (() => {
                const todayGroup = data.completed.filter((g) => g.label === 'Today');
                const yesterdayGroup = data.completed.filter((g) => g.label === 'Yesterday');
                const earlier = data.completed.filter(
                  (g) => g.label !== 'Today' && g.label !== 'Yesterday'
                );
                return (
                  <>
                    {renderDateGroups(todayGroup, 'completed')}
                    {renderDateGroups(yesterdayGroup, 'completed')}
                    {earlier.length > 0 && (
                      <div className="todo-bucket">
                        <h2 className="todo-bucket__title">Earlier this week</h2>
                        {renderDateGroups(earlier, 'completed')}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        )}
      </main>

      <TaskDrawer
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onChanged={refresh}
      />

      <AddTaskModal
        open={dsaModalOpen}
        onClose={() => setDsaModalOpen(false)}
        onCreated={() => {
          void fetch(true);
        }}
      />

      <AssignmentForm
        open={assignmentFormOpen}
        editing={editingAssignment}
        onClose={() => setAssignmentFormOpen(false)}
        onSaved={() => {
          void fetch(true);
        }}
      />

      {dateTarget && (
        <div className="todo-reschedule-overlay" onClick={() => setDateTarget(null)}>
          <div onClick={(e) => e.stopPropagation()}>
            <TodoDatePicker
              value={{
                dateKey: dateTarget.scheduledDateKey ?? null,
                dueTime: dateTarget.dueTime ?? null,
                durationMin: dateTarget.durationMin ?? null,
                recurrence: dateTarget.recurrence ?? null,
              }}
              onApply={(selection) => void applyDateToTask(selection)}
              onClose={() => setDateTarget(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
