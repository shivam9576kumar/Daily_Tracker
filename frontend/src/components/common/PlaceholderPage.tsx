interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="placeholder-page">
      <h1 className="t-h1">{title}</h1>
      <p className="t-body">Coming Soon</p>
      <div className="placeholder-page__bar" aria-hidden="true" />
    </div>
  );
}
