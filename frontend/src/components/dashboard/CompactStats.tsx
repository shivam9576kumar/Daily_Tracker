export default function CompactStats({
  streak,
  coins,
  remaining,
  activePlanName,
}: {
  streak: number;
  coins: number;
  remaining: number;
  activePlanName: string | null;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="compact-stats">
      <div className="compact-stats__greeting">
        <span className="compact-stats__emoji">🌤️</span>
        <div>
          <h1 className="compact-stats__title">
            {greeting}
          </h1>
          <p className="compact-stats__sub">
            {activePlanName ? `${activePlanName} · ` : ''}{remaining === 0 ? 'All done for today!' : `${remaining} tasks left today.`}
          </p>
        </div>
      </div>
      <div className="compact-stats__tokens">
        <span className="token">🔥 {streak}</span>
        <span className="token">🪙 {coins}</span>
      </div>
    </header>
  );
}
