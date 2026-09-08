import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuthStore } from '../store/authStore';
import TodayClassStrip from '../components/classes/TodayClassStrip';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { formatKey, todayKey } from '../utils/dateKeys';
import type { Assignment } from '../types';
import '../components/dashboard/dashboard.css';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dueLabel(a: Assignment): string {
  if (a.urgency === 'today') return 'Due today';
  if (a.urgency === 'tomorrow') return 'Due tomorrow';
  return 'Upcoming';
}

export default function Dashboard() {
  const { data, loading, error, fetch } = useDashboardStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const dueSoon = useMemo(
    () =>
      (data?.pendingAssignments ?? [])
        .filter((a) => a.urgency === 'today' || a.urgency === 'tomorrow')
        .slice(0, 4),
    [data]
  );

  // ── all hooks above ──

  if (loading && !data) {
    return (
      <div className="dashboard">
        <Spinner large />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dashboard">
        <div className="empty-state">
          <div className="empty-emoji">😵</div>
          <div className="empty-text">{error}</div>
          <Button onClick={() => void fetch()}>Retry</Button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const firstName = user?.name?.split(' ')[0] || 'there';
  const { streak, coins, backlog } = data.statusOverview;
  const potdEnabled = data.dailyChallenges?.potd.enabled ?? data.potdStreak?.enabled ?? true;
  const potdStreak = potdEnabled ? (data.potdStreak?.currentStreak ?? 0) : 0;
  const cp31Streak = (data?.cp31Streak?.enabled || data?.dailyChallenges?.cp31?.enabled)
    ? (data?.cp31Streak?.currentStreak ?? 0)
    : 0;
  const pending = data.todaysHitlist.pending.length;
  const completed = data.todaysHitlist.completed.length;
  const assignmentsDueToday = (data.pendingAssignments ?? []).filter(
    (a) => a.urgency === 'today'
  ).length;

  let ctaTitle: string;
  let ctaSub: string | null = null;
  let ctaButton: { label: string; to: string };

  if (pending > 0) {
    ctaTitle = `${pending} task${pending === 1 ? '' : 's'} remaining today`;
    const subParts: string[] = [];
    if (completed > 0) subParts.push(`${completed} done`);
    if (assignmentsDueToday > 0) {
      subParts.push(
        `${assignmentsDueToday} assignment${assignmentsDueToday === 1 ? '' : 's'} due`
      );
    }
    ctaSub = subParts.length > 0 ? subParts.join(' · ') : null;
    ctaButton = { label: 'Open Todo →', to: '/todo?view=today' };
  } else if (completed > 0) {
    ctaTitle = 'All done for today 🎉';
    ctaSub = `${completed} task${completed === 1 ? '' : 's'} completed`;
    ctaButton = { label: 'Open Todo →', to: '/todo?view=today' };
  } else if (!data.hasActivePlan) {
    ctaTitle = 'No active plan';
    ctaSub = 'Generate a plan to get a daily hitlist.';
    ctaButton = { label: 'Generate Plan', to: '/generate-plan' };
  } else {
    ctaTitle = 'Nothing due today';
    ctaSub = 'Enjoy the light day — or get ahead in Todo.';
    ctaButton = { label: 'Open Todo →', to: '/todo?view=today' };
  }

  return (
    <div className="dashboard dashboard--overview">
      <header className="ov-head">
        <h1 className="ov-head__greeting">
          {greeting()}, {firstName}
        </h1>
        <p className="ov-head__date">{formatKey(todayKey(), {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })}</p>
      </header>

      <div className="ov-stats" role="list">
        <span className="ov-stat" role="listitem" title="Current streak">
          🔥 <strong className="num">{streak}</strong> streak
        </span>
        <span className="ov-stat" role="listitem" title="Coins">
          🪙 <strong className="num">{coins}</strong> coins
        </span>
        {backlog > 0 && (
          <button
            type="button"
            className="ov-stat ov-stat--action ov-stat--warn"
            title="Open backlog in Todo"
            onClick={() => navigate('/todo?view=backlog')}
          >
            ⚠ <strong className="num">{backlog}</strong> backlog
          </button>
        )}
        {potdStreak > 0 && (
          <span className="ov-stat" role="listitem" title="POTD streak">
            ⚡ POTD ×<strong className="num">{potdStreak}</strong>
          </span>
        )}
        {cp31Streak > 0 && (
          <span className="ov-stat" role="listitem" title="CP31 streak">
            ⚔️ CP31 ×<strong className="num">{cp31Streak}</strong>
          </span>
        )}
      </div>

      <section className="card ov-cta">
        <div className="ov-cta__text">
          <h2 className="ov-cta__title">{ctaTitle}</h2>
          {ctaSub && <p className="ov-cta__sub">{ctaSub}</p>}
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => navigate(ctaButton.to)}
        >
          {ctaButton.label}
        </button>
      </section>

      {data.classes && data.classes.length > 0 && (
        <TodayClassStrip classes={data.classes} />
      )}

      {dueSoon.length > 0 && (
        <section className="card ov-due">
          <div className="ov-due__head">
            <h2 className="t-h2">📌 Due soon</h2>
            <button
              type="button"
              className="t-link"
              onClick={() => navigate('/todo?view=today')}
            >
              Open Todo
            </button>
          </div>
          {dueSoon.map((a) => (
            <button
              key={a.id}
              type="button"
              className="ov-due__row"
              onClick={() => navigate('/todo?view=today')}
            >
              <span className="ov-due__title">{a.title}</span>
              <span
                className={`ov-due__badge${
                  a.urgency === 'today' ? ' is-today' : ''
                }`}
              >
                {dueLabel(a)}
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
