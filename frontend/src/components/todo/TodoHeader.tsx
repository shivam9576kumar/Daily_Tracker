import type { ReactNode } from 'react';
import './todo.css';

interface Props {
  title: string;
  description: string;
  action?: ReactNode;
}

export default function TodoHeader({ title, description, action }: Props) {
  return (
    <header className="todo-header">
      <div>
        <h1 className="todo-header__title">{title}</h1>
        <p className="todo-header__description">{description}</p>
      </div>
      {action && <div className="todo-header__action">{action}</div>}
    </header>
  );
}
