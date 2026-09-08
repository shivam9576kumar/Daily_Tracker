import type { ReactNode } from 'react';
import './todo.css';

interface Props {
  count: number;
  children: ReactNode;
}

export default function TodoCompletedSection({ count, children }: Props) {
  if (count === 0) return null;
  return (
    <details className="todo-completed-details">
      <summary>
        <span>Completed Today</span>
        <span className="todo-section__count">{count}</span>
      </summary>
      <div className="todo-completed-details__body">{children}</div>
    </details>
  );
}
