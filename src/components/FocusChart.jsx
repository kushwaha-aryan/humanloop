import { Button, EmptyState } from './ui.jsx';
import { formatDuration } from '../lib/fmt.js';

export function FocusChart({ stats, onStartFocus }) {
  const total = stats.focusMinutesWeek;
  const max = Math.max(25, ...stats.last7.map((day) => day.minutes));
  const bestDay = stats.last7.reduce((best, day) => (day.minutes > (best?.minutes || 0) ? day : best), null);

  return (
    <section className="card chart-card" aria-labelledby="chart-title">
      <div className="card-head">
        <div>
          <p className="eyebrow">Measured, not assumed</p>
          <h2 id="chart-title" className="card-title">
            Focus rhythm
          </h2>
        </div>
        <span className="card-meta">Last 7 days</span>
      </div>

      {total === 0 ? (
        <EmptyState
          compact
          icon="focus"
          title="No focus time logged"
          body="Run a real timer on a real task. The chart only moves when a session is completed or ended."
          action={
            <Button size="sm" variant="secondary" icon="focus" onClick={onStartFocus}>
              Start a session
            </Button>
          }
        />
      ) : (
        <>
          <div className="chart-figures">
            <div>
              <strong>{formatDuration(total)}</strong>
              <span>focused this week</span>
            </div>
            <div>
              <strong>{stats.avgSession}m</strong>
              <span>average session</span>
            </div>
            <div>
              <strong>{bestDay ? formatDuration(bestDay.minutes) : '—'}</strong>
              <span>best day</span>
            </div>
          </div>

          <div className="chart" role="img" aria-label={`Focus minutes for the last seven days, totalling ${total} minutes.`}>
            {stats.last7.map((day) => (
              <div key={day.iso} className={`chart-col ${day.isToday ? 'is-today' : ''}`}>
                <span className="chart-value">{day.minutes > 0 ? day.minutes : ''}</span>
                <div className="chart-track">
                  <span
                    className={`chart-bar ${day.isToday ? 'is-today' : ''}`}
                    style={{ height: `${Math.max(day.minutes > 0 ? 8 : 2, (day.minutes / max) * 100)}%` }}
                  />
                </div>
                <span className="chart-label">{day.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
