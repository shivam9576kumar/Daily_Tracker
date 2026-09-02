import './task.css';

interface Props {
  revisionNumber: number;
}

export default function RevisionBadge({ revisionNumber }: Props) {
  return (
    <span className="tag tag-revision">
      Rev #{revisionNumber}
    </span>
  );
}
