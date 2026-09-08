import type { ReactNode } from 'react';
import './todo.css';

interface Props {
  title: string;
  count: number;
  tone?: 'default' | 'warning' | 'brand';
  children: ReactNode;
}

export default function TodoSection({ title, count, tone = 'default', children }: Props) {
  if (count === 0) return null;
  return (
    <section className={`todo-section todo-section--${tone}`}>
      <div className="todo-section__header">
        <h2 className="todo-section__title">{title}</h2>
        <span className="todo-section__count">{count}</span>
      </div>
      {children}
    </section>
  );
}
