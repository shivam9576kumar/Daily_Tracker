import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import TodoSidebar, {
  type TodoCounts,
  type TodoView,
} from '../components/todo/TodoSidebar';
import TaskRow from '../components/dashboard/TaskRow';
import TaskDrawer from '../components/task/TaskDrawer';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { dashboardApi } from '../services/dashboardApi';
import { taskApi } from '../services/taskApi';
import { assignmentApi } from '../services/assignmentApi';
import { planApi } from '../services/planApi';
import { getErrorMessage } from '../services/api';
import { useTaskActions } from '../hooks/useTaskActions';
import { useUIStore } from '../store/uiStore';
import {
  addDaysToKey,
  formatKey,
  localKey,
  todayKey,
} from '../utils/dateKeys';
import type {
  Assignment,
  DashboardData,
  Task,
} from '../types';
import '../components/todo/todo.css';

const VALID_VIEWS: TodoView[] = [
  'inbox',
  'today',
  'upcoming',
  'backlog',
  'completed',
];

const VIEW_META: Record<
  TodoView,
  { title: string; description: string }
> = {
  inbox: {
    title: 'Inbox',
    description: 'Unscheduled personal tasks will live here.',
  },
  today: {
    title: 'Today',
    description: 'Everything that needs your attention today.',
  },
  upcoming: {
    title: 'Upcoming',
    description: 'Your scheduled work for the next 14 days.',
  },
  backlog: {
    title: 'Backlog',
    description: 'Overdue work that still needs to be completed.',
  },
  completed: {
    title: 'Completed',
    description: 'Your recently completed work.',
  },
};

interface UpcomingGroup {
  dateKey: string;
  tasks: Task[];
  assignments: Assignment[];
}

interface CompletedGroup {
  dateKey: string;
  tasks: Task[];
  assignments: Assignment[];
}

function isTodoView(value: string | null): value is TodoView {
  return value !== null && VALID_VIEWS.includes(value as TodoView);
}

function taskScheduledKey(task: Task): string | null {
  if (task.scheduledDateKey) return task.scheduledDateKey;

  const fallback = task.scheduledDate?.slice(0, 10);
  return fallback && /^\d{4}-\d{2}-\d{2}$/.test(fallback)
    ? fallback
    : null;
}

function assignmentDateKey(assignment: Assignment): string | null {
  const key = assignment.deadline?.slice(0, 10);
  return key && /^\d{4}-\d{2}-\d{2}$/.test(key)
    ? key
    : null;
}

function isOpenBacklog(task: Task): boolean {
  return (
    task.status !== 'completed' &&
    task.status !== 'expired' &&
    (task.status === 'backlog' || task.isBacklog)
  );
}

function TodoSection({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: 'default' | 'warning' | 'brand';
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section
      className={`todo-section todo-section--${tone ?? 'default'}`}
    >
      <div className="todo-section__header">
        <h2 className="todo-section__title">{title}</h2>
        <span className="todo-section__count">{count}</span>
      </div>
      {children}
    </section>
  );
}

function AssignmentRow({
  assignment,
  busy,
  onToggle,
}: {
  assignment: Assignment;
  busy: boolean;
  onToggle: (assignment: Assignment) => void;
}) {
  const completed = assignment.status === 'completed';
  const dueKey = assignmentDateKey(assignment);

  return (
    <div
      className={`todo-assignment${completed ? ' is-completed' : ''}`}
    >
      <input
        type="checkbox"
        className="todo-assignment__check"
        checked={completed}
        disabled={busy}
        aria-label={
          completed
            ? `Reopen ${assignment.title}`
            : `Complete ${assignment.title}`
        }
        onChange={() => onToggle(assignment)}
      />

      <div className="todo-assignment__body">
        <span className="todo-assignment__title">
          {assignment.title}
        </span>

        <div className="todo-assignment__meta">
          <span>Assignment</span>
          {dueKey && <span>Due {formatKey(dueKey)}</span>}
        </div>
      </div>
    </div>
  );
}

function EmptyView({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="todo-empty">
      <span className="todo-empty__icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="todo-empty__title">{title}</h2>
      <p className="todo-empty__description">{description}</p>
    </div>
  );
}

export default function TodoPage() {
  const toast = useUIStore((state) => state.toast);
  const [searchParams, setSearchParams] = useSearchParams();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [assignmentBusyId, setAssignmentBusyId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const requestedView = searchParams.get('view');
  const activeView: TodoView = isTodoView(requestedView)
    ? requestedView
    : 'today';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      /*
       * Dashboard remains the authoritative Today query because it:
       * - ensures POTD exists,
       * - uses the user's timezone,
       * - includes open backlog,
       * - includes tasks completed today.
       */
      const dashboardResult = await dashboardApi.getToday();

      const [tasksResult, assignmentsResult, activePlanResult] =
        await Promise.all([
          taskApi.getAll(),
          assignmentApi.getAll(),
          planApi.getActive(),
        ]);

      setDashboard(dashboardResult);
      setAllTasks(tasksResult);
      setAssignments(assignmentsResult);
      setActivePlanId(activePlanResult.plan?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);
  const actions = useTaskActions(refresh);

  const setActiveView = useCallback(
    (view: TodoView) => {
      setSearchParams({ view }, { replace: true });
    },
    [setSearchParams]
  );

  const handleAssignmentToggle = useCallback(
    async (assignment: Assignment) => {
      if (assignmentBusyId) return;

      setAssignmentBusyId(assignment.id);

      try {
        if (assignment.status === 'completed') {
          await assignmentApi.reopen(assignment.id);
          toast('Assignment reopened', 'info');
        } else {
          await assignmentApi.complete(assignment.id);
          toast('Assignment completed', 'success');
        }

        await load(true);
      } catch (mutationError) {
        toast(getErrorMessage(mutationError), 'error');
      } finally {
        setAssignmentBusyId(null);
      }
    },
    [assignmentBusyId, load, toast]
  );

  const currentKey = todayKey();
  const upcomingEndKey = addDaysToKey(currentKey, 14);
  const completedStartKey = addDaysToKey(currentKey, -6);

  const visibleTasks = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          task.planId === null ||
          (activePlanId !== null && task.planId === activePlanId)
      ),
    [allTasks, activePlanId]
  );

  const todayPending = useMemo(
    () => [...(dashboard?.todaysHitlist.pending ?? [])],
    [dashboard]
  );

  const todayCompleted = useMemo(
    () => [...(dashboard?.todaysHitlist.completed ?? [])],
    [dashboard]
  );

  const todayGroups = useMemo(() => {
    const backlog = todayPending.filter(isOpenBacklog);

    const regular = todayPending.filter(
      (task) => !isOpenBacklog(task)
    );

    return {
      backlog,
      plan: regular.filter(
        (task) => task.taskType === 'new' && task.planId !== null
      ),
      potd: regular.filter((task) => task.taskType === 'potd'),
      revisions: regular.filter(
        (task) => task.taskType === 'revision'
      ),
      manual: regular.filter(
        (task) => task.taskType === 'new' && task.planId === null
      ),
    };
  }, [todayPending]);

  const todayAssignments = useMemo(
    () =>
      assignments
        .filter((assignment) => assignment.status === 'pending')
        .filter((assignment) => {
          const key = assignmentDateKey(assignment);
          return key !== null && key <= currentKey;
        })
        .sort((a, b) => a.deadline.localeCompare(b.deadline)),
    [assignments, currentKey]
  );

  const upcomingGroups = useMemo<UpcomingGroup[]>(() => {
    const groups = new Map<string, UpcomingGroup>();

    for (const task of visibleTasks) {
      const key = taskScheduledKey(task);

      if (
        !key ||
        key <= currentKey ||
        key > upcomingEndKey ||
        task.status !== 'pending' ||
        task.isBacklog ||
        task.isExpired
      ) {
        continue;
      }

      const group = groups.get(key) ?? {
        dateKey: key,
        tasks: [],
        assignments: [],
      };

      group.tasks.push(task);
      groups.set(key, group);
    }

    for (const assignment of assignments) {
      const key = assignmentDateKey(assignment);

      if (
        assignment.status !== 'pending' ||
        !key ||
        key <= currentKey ||
        key > upcomingEndKey
      ) {
        continue;
      }

      const group = groups.get(key) ?? {
        dateKey: key,
        tasks: [],
        assignments: [],
      };

      group.assignments.push(assignment);
      groups.set(key, group);
    }

    return [...groups.values()]
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .map((group) => ({
        ...group,
        tasks: group.tasks.sort((a, b) =>
          a.title.localeCompare(b.title)
        ),
        assignments: group.assignments.sort((a, b) =>
          a.title.localeCompare(b.title)
        ),
      }));
  }, [assignments, currentKey, upcomingEndKey, visibleTasks]);

  const backlogTasks = useMemo(
    () =>
      visibleTasks
        .filter(isOpenBacklog)
        .sort((a, b) => {
          const aKey = taskScheduledKey(a) ?? '';
          const bKey = taskScheduledKey(b) ?? '';
          return aKey.localeCompare(bKey);
        }),
    [visibleTasks]
  );

  const completedGroups = useMemo<CompletedGroup[]>(() => {
    const groups = new Map<string, CompletedGroup>();

    for (const task of visibleTasks) {
      if (task.status !== 'completed' || !task.completedAt) continue;

      const key = localKey(new Date(task.completedAt));
      if (key < completedStartKey || key > currentKey) continue;

      const group = groups.get(key) ?? {
        dateKey: key,
        tasks: [],
        assignments: [],
      };

      group.tasks.push(task);
      groups.set(key, group);
    }

    for (const assignment of assignments) {
      if (
        assignment.status !== 'completed' ||
        !assignment.completedAt
      ) {
        continue;
      }

      const key = localKey(new Date(assignment.completedAt));
      if (key < completedStartKey || key > currentKey) continue;

      const group = groups.get(key) ?? {
        dateKey: key,
        tasks: [],
        assignments: [],
      };

      group.assignments.push(assignment);
      groups.set(key, group);
    }

    return [...groups.values()].sort((a, b) =>
      b.dateKey.localeCompare(a.dateKey)
    );
  }, [assignments, completedStartKey, currentKey, visibleTasks]);

  const upcomingCount = useMemo(
    () =>
      upcomingGroups.reduce(
        (total, group) =>
          total + group.tasks.length + group.assignments.length,
        0
      ),
    [upcomingGroups]
  );

  const completedCount = useMemo(
    () =>
      completedGroups.reduce(
        (total, group) =>
          total + group.tasks.length + group.assignments.length,
        0
      ),
    [completedGroups]
  );

  const counts: TodoCounts = {
    inbox: 0,
    today: todayPending.length + todayAssignments.length,
    upcoming: upcomingCount,
    backlog: backlogTasks.length,
    completed: completedCount,
  };

  const renderTasks = (tasks: Task[]) => (
    <div className="todo-task-list">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          busy={actions.busyId === task.id}
          onOpen={(selected) => setSelectedTaskId(selected.id)}
          onToggleSolved={actions.toggleSolved}
          onRate={actions.rate}
          onUnrate={actions.unrate}
        />
      ))}
    </div>
  );

  const renderAssignments = (items: Assignment[]) => (
    <div className="todo-assignment-list">
      {items.map((assignment) => (
        <AssignmentRow
          key={assignment.id}
          assignment={assignment}
          busy={assignmentBusyId === assignment.id}
          onToggle={handleAssignmentToggle}
        />
      ))}
    </div>
  );

  if (loading && !dashboard) {
    return (
      <div className="todo-loading">
        <Spinner large />
      </div>
    );
  }

  if (error && !dashboard) {
    return (
      <div className="todo-load-error">
        <span className="todo-load-error__icon" aria-hidden="true">
          ⚠️
        </span>
        <h1 className="t-h2">Unable to load Todo</h1>
        <p className="t-body">{error}</p>
        <Button onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  const meta = VIEW_META[activeView];

  return (
    <div className="todo-page">
      <TodoSidebar
        activeView={activeView}
        counts={counts}
        onChange={setActiveView}
      />

      <main className="todo-main">
        <header className="todo-header">
          <div>
            <h1 className="todo-header__title">{meta.title}</h1>
            <p className="todo-header__description">
              {activeView === 'today'
                ? `${formatKey(currentKey)} · ${meta.description}`
                : meta.description}
            </p>
          </div>
        </header>

        {error && (
          <div className="todo-inline-error" role="status">
            Some data could not be refreshed: {error}
          </div>
        )}

        {activeView === 'inbox' && (
          <EmptyView
            icon="📥"
            title="No inbox tasks yet"
            description="Personal task capture will be added in Part 5."
          />
        )}

        {activeView === 'today' && (
          <div className="todo-view">
            <TodoSection
              title="Overdue / Backlog"
              count={todayGroups.backlog.length}
              tone="warning"
            >
              {renderTasks(todayGroups.backlog)}
            </TodoSection>

            <TodoSection
              title="Today’s Study Plan"
              count={todayGroups.plan.length}
            >
              {renderTasks(todayGroups.plan)}
            </TodoSection>

            <TodoSection
              title="Daily Challenge"
              count={todayGroups.potd.length}
              tone="brand"
            >
              {renderTasks(todayGroups.potd)}
            </TodoSection>

            <TodoSection
              title="Revisions Due"
              count={todayGroups.revisions.length}
            >
              {renderTasks(todayGroups.revisions)}
            </TodoSection>

            <TodoSection
              title="Manual DSA Tasks"
              count={todayGroups.manual.length}
            >
              {renderTasks(todayGroups.manual)}
            </TodoSection>

            <TodoSection
              title="Assignments Due"
              count={todayAssignments.length}
              tone="warning"
            >
              {renderAssignments(todayAssignments)}
            </TodoSection>

            {todayPending.length === 0 &&
              todayAssignments.length === 0 &&
              todayCompleted.length === 0 && (
                <EmptyView
                  icon="🌤️"
                  title="Nothing due today"
                  description="Your study list is clear for today."
                />
              )}

            {todayCompleted.length > 0 && (
              <details className="todo-completed-details">
                <summary>
                  <span>Completed Today</span>
                  <span className="todo-section__count">
                    {todayCompleted.length}
                  </span>
                </summary>

                <div className="todo-completed-details__body">
                  {renderTasks(todayCompleted)}
                </div>
              </details>
            )}
          </div>
        )}

        {activeView === 'upcoming' && (
          <div className="todo-view">
            {upcomingGroups.length === 0 ? (
              <EmptyView
                icon="📆"
                title="No upcoming work"
                description="Nothing is currently scheduled in the next 14 days."
              />
            ) : (
              upcomingGroups.map((group) => (
                <section
                  key={group.dateKey}
                  className="todo-date-group"
                >
                  <div className="todo-date-group__header">
                    <h2>{formatKey(group.dateKey)}</h2>
                    <span>
                      {group.tasks.length +
                        group.assignments.length}{' '}
                      items
                    </span>
                  </div>

                  {renderTasks(group.tasks)}
                  {renderAssignments(group.assignments)}
                </section>
              ))
            )}
          </div>
        )}

        {activeView === 'backlog' && (
          <div className="todo-view">
            {backlogTasks.length === 0 ? (
              <EmptyView
                icon="✅"
                title="Backlog is clear"
                description="You have no overdue study tasks."
              />
            ) : (
              <TodoSection
                title="Needs Attention"
                count={backlogTasks.length}
                tone="warning"
              >
                {renderTasks(backlogTasks)}
              </TodoSection>
            )}
          </div>
        )}

        {activeView === 'completed' && (
          <div className="todo-view">
            {completedGroups.length === 0 ? (
              <EmptyView
                icon="🕊️"
                title="No recent completions"
                description="Completed work from the last seven days will appear here."
              />
            ) : (
              completedGroups.map((group) => (
                <section
                  key={group.dateKey}
                  className="todo-date-group"
                >
                  <div className="todo-date-group__header">
                    <h2>
                      {group.dateKey === currentKey
                        ? 'Today'
                        : group.dateKey ===
                            addDaysToKey(currentKey, -1)
                          ? 'Yesterday'
                          : formatKey(group.dateKey)}
                    </h2>

                    <span>
                      {group.tasks.length +
                        group.assignments.length}{' '}
                      completed
                    </span>
                  </div>

                  {renderTasks(group.tasks)}
                  {renderAssignments(group.assignments)}
                </section>
              ))
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
