import './todo.css';

interface Props {
  icon: string;
  title: string;
  description: string;
}

export default function TodoEmpty({ icon, title, description }: Props) {
  return (
    <div className="todo-empty">
      <span className="todo-empty__icon" aria-hidden="true">{icon}</span>
      <h2 className="todo-empty__title">{title}</h2>
      <p className="todo-empty__description">{description}</p>
    </div>
  );
}
