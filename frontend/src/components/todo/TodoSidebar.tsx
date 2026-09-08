import './todo.css';

export type TodoView =
  | 'inbox'
  | 'today'
  | 'upcoming'
  | 'backlog'
  | 'completed';

export interface TodoCounts {
  inbox: number;
  today: number;
  upcoming: number;
  backlog: number;
  completed: number;
}

interface Props {
  activeView: TodoView;
  counts: TodoCounts;
  onChange: (view: TodoView) => void;
  onAddTask: () => void;
}

const ITEMS: Array<{
  view: TodoView;
  label: string;
  icon: string;
}> = [
  { view: 'inbox', label: 'Inbox', icon: '📥' },
  { view: 'today', label: 'Today', icon: '📅' },
  { view: 'upcoming', label: 'Upcoming', icon: '📆' },
  { view: 'backlog', label: 'Backlog', icon: '⚠️' },
  { view: 'completed', label: 'Completed', icon: '✅' },
];

export default function TodoSidebar({
  activeView,
  counts,
  onChange,
  onAddTask,
}: Props) {
  return (
    <aside className="todo-sidebar" aria-label="Todo views">
      <div className="todo-sidebar__brand">
        <span className="todo-sidebar__brand-icon" aria-hidden="true">
          ✓
        </span>
        <span>Todo</span>
      </div>

      <button type="button" className="todo-sidebar__add" onClick={onAddTask}>
        <span className="todo-sidebar__add-plus" aria-hidden="true">+</span>
        Add Task
      </button>

      <nav className="todo-sidebar__nav">
        {ITEMS.map((item) => {
          const active = activeView === item.view;
          const count = counts[item.view];

          return (
            <button
              key={item.view}
              type="button"
              className={`todo-sidebar__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onChange(item.view)}
            >
              <span className="todo-sidebar__item-icon" aria-hidden="true">
                {item.icon}
              </span>

              <span className="todo-sidebar__item-label">
                {item.label}
              </span>

              {count > 0 && (
                <span className="todo-sidebar__count">{count}</span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
