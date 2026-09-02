import './common.css';

export default function Spinner({ large }: { large?: boolean }) {
  return (
    <div className="spinner-center">
      <div className={`spinner ${large ? 'spinner-lg' : ''}`} />
    </div>
  );
}
