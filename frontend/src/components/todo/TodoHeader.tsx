import './todo.css';

interface Props {
  title: string;
  description: string;
}

export default function TodoHeader({ title, description }: Props) {
  return (
    <header className="todo-header">
      <div>
        <h1 className="todo-header__title">{title}</h1>
        <p className="todo-header__description">{description}</p>
      </div>
    </header>
  );
}
