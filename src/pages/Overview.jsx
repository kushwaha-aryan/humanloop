import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Icon } from '../components/Icons.jsx';
import { Badge, Button, DueBadge, EmptyState, PageHeader, ProgressRing, Textarea } from '../components/ui.jsx';
import { AdaptiveAssistant } from '../components/AdaptiveAssistant.jsx';
import { ActivityFeed } from '../components/ActivityFeed.jsx';
import { FocusChart } from '../components/FocusChart.jsx';
import { formatDueDate, formatDuration, formatLongDate, greeting, timeAgo } from '../lib/fmt.js';
import { getNextTasks } from '../lib/stats.js';

const QUICK_CHIPS = [
  'I have too much due this week and no idea where to start',
  'I keep putting off an important bill',
  'Three hours free, five things I care about',
];

export default function Overview({ navigate, onQuickPlan, onStartFocus }) {
  const { state, stats, health, completeTask, toast } = useApp();
  const [quick, setQuick] = useState('');
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);

  const firstName = state.profile.name.trim().split(' ')[0];
  const heading = firstName ? `${greeting()}, ${firstName}.` : `${greeting()}.`;
  const next = getNextTasks(state.tasks, 4);
  const activities = state.activities.slice(0, 6);
  const isNew = stats.total === 0;

  const description = isNew
    ? 'Nothing is tracked yet. Describe what is competing for your attention and HumanLoop will turn it into a realistic first plan.'
    : stats.pending === 0
      ? 'Everything in the workspace is closed. Use the quiet to decide what actually deserves tomorrow.'
      : `${stats.pending} open task${stats.pending === 1 ? '' : 's'}${stats.highOpen ? `, ${stats.highOpen} marked high priority` : ''}${stats.overdue ? `, ${stats.overdue} overdue` : ''}. Pick one clear action rather than the whole list.`;

  const submitQuick = (event) => {
    event.preventDefault();
    const text = quick.trim();
    if (text.length < 8) {
      toast('Describe the situation in at least a sentence so the plan has something to work with.', 'error');
      return;
    }
    setQuick('');
    onQuickPlan(text);
  };

  const startNextFocus = (task) => {
    onStartFocus(task.id);
    toast(`“${task.title}” is queued in Focus Mode.`, 'default');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow={`Overview · ${formatLongDate()}`}
        title={heading}
        description={description}
        actions={
          <>
            <Button icon="rotate" onClick={() => setAdaptiveOpen(true)}>
              Something changed
            </Button>
            <Button variant="primary" icon="clarity" iconRight="arrowRight" onClick={() => navigate('clarity')}>
              Plan my next step
            </Button>
          </>
        }
      />

      {health.mode === 'demo' ? (
        <div className="demo-banner">
          <span className="demo-banner-mark">
            <Icon name="bulb" size={16} />
          </span>
          <p>
            <strong>Demo mode.</strong> AI responses are realistic samples generated locally from your words — not live model output. Add
            <code> GROQ_API_KEY</code> to <code>.env</code> and restart to switch on live AI.
          </p>
          <button type="button" className="text-btn" onClick={() => navigate('settings')}>
            Details
          </button>
        </div>
      ) : null}

      <div className="grid-overview-top">
        <section className="card today-card" aria-labelledby="today-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">Momentum</p>
              <h2 id="today-title" className="card-title">
                Today’s progress
              </h2>
            </div>
            {stats.streak.days > 0 ? (
              <Badge tone="accent">{stats.streak.days}-day focus streak</Badge>
            ) : (
              <Badge tone="neutral">No streak yet</Badge>
            )}
          </div>

          <div className="today-grid">
            <ProgressRing
              value={stats.completionPct}
              size={136}
              stroke={9}
              label={`${stats.completionPct}%`}
              sublabel="of all tasks"
            />
            <div className="today-figures">
              <div className="figure">
                <span className="figure-value">{stats.completedToday}</span>
                <span className="figure-label">Closed today</span>
              </div>
              <div className="figure">
                <span className="figure-value">{formatDuration(stats.focusMinutesToday)}</span>
                <span className="figure-label">Focus today</span>
              </div>
              <div className="figure">
                <span className="figure-value">{stats.pending}</span>
                <span className="figure-label">Still open</span>
              </div>
              <div className="figure">
                <span className="figure-value">{stats.sessionsToday}</span>
                <span className="figure-label">Sessions</span>
              </div>
            </div>
          </div>

          <div className="capacity">
            <div className="capacity-head">
              <span>Focus against daily capacity</span>
              <span className="capacity-value">
                {formatDuration(stats.focusMinutesToday)} / {formatDuration(stats.capacity)}
              </span>
            </div>
            <div className="meter" role="presentation">
              <span style={{ width: `${stats.capacityPct}%` }} />
            </div>
          </div>

          <div className="today-foot">
            <Button size="sm" variant="primary" icon="focus" onClick={() => navigate('focus')}>
              Enter Focus Mode
            </Button>
            <span className="today-foot-note">
              {isNew
                ? 'Numbers stay at zero until real work is logged.'
                : `${stats.completed} of ${stats.total} tasks closed in total.`}
            </span>
          </div>
        </section>

        <section className="card next-card" aria-labelledby="next-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">Priority order</p>
              <h2 id="next-title" className="card-title">
                Next up
              </h2>
            </div>
            <Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => navigate('tasks')}>
              All tasks
            </Button>
          </div>

          {next.length === 0 ? (
            <EmptyState
              compact
              icon={isNew ? 'clarity' : 'check'}
              title={isNew ? 'No tasks yet' : 'Nothing open'}
              body={
                isNew
                  ? 'Start with a plain-language description of what is on your mind. The Clarity Engine turns it into a short plan.'
                  : 'Your workspace is clear. Write a reflection on what worked, or plan tomorrow before the day fills up.'
              }
              action={
                <Button size="sm" variant="primary" icon="clarity" onClick={() => navigate('clarity')}>
                  {isNew ? 'Describe your situation' : 'Plan the next block'}
                </Button>
              }
            />
          ) : (
            <ul className="next-list">
              {next.map((task) => {
                const due = task.dueDate ? formatDueDate(task.dueDate) : null;
                return (
                  <li key={task.id} className="next-item">
                    <button
                      type="button"
                      className="task-check"
                      aria-label={`Mark “${task.title}” as complete`}
                      onClick={() => {
                        completeTask(task.id);
                        toast(`Completed “${task.title}”.`, 'success');
                      }}
                    >
                      <Icon name="check" size={12} />
                    </button>
                    <div className="next-item-main">
                      <button type="button" className="next-item-title" onClick={() => navigate('focus')}>
                        {task.title}
                      </button>
                      <div className="task-meta">
                        <span className={`priority-dot priority-${task.priority.toLowerCase()}`} aria-hidden="true" />
                        <span>{task.priority}</span>
                        <span className="meta-sep" aria-hidden="true" />
                        <span>{formatDuration(task.durationMinutes)}</span>
                        {due ? (
                          <>
                            <span className="meta-sep" aria-hidden="true" />
                            <DueBadge due={due} />
                          </>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-btn icon-btn-ghost"
                      onClick={() => startNextFocus(task)}
                      aria-label={`Start focus on “${task.title}”`}
                      title="Start focus"
                    >
                      <Icon name="play" size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {isNew ? (
            <ol className="onboarding">
              <li>
                <span className="onboarding-step">01</span>
                <button type="button" onClick={() => navigate('clarity')}>
                  Describe the chaos in plain language
                </button>
              </li>
              <li>
                <span className="onboarding-step">02</span>
                <button type="button" onClick={() => navigate('tasks')}>
                  Add the tasks that survive the cut
                </button>
              </li>
              <li>
                <span className="onboarding-step">03</span>
                <button type="button" onClick={() => navigate('focus')}>
                  Work one block, then log it
                </button>
              </li>
            </ol>
          ) : null}
        </section>
      </div>

      <div className="grid-overview-mid">
        <section className="card quick-card" aria-labelledby="quick-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">AI Clarity · quick capture</p>
              <h2 id="quick-title" className="card-title">
                What is loudest right now?
              </h2>
            </div>
            <span className="ai-mark" aria-hidden="true">
              <Icon name="brain" size={16} />
            </span>
          </div>
          <form onSubmit={submitQuick} className="quick-form">
            <label className="sr-only" htmlFor="quick-input">
              Describe your current situation
            </label>
            <Textarea
              id="quick-input"
              rows={4}
              value={quick}
              onChange={(event) => setQuick(event.target.value)}
              placeholder="Be blunt. Deadlines, half-finished work, the thing you keep avoiding. No need to sound organised."
              maxLength={4000}
            />
            <div className="quick-actions">
              <div className="chips">
                {QUICK_CHIPS.slice(0, 2).map((chip) => (
                  <button key={chip} type="button" className="chip" onClick={() => setQuick(chip)}>
                    {chip}
                  </button>
                ))}
              </div>
              <Button type="submit" variant="primary" size="sm" iconRight="arrowRight" disabled={quick.trim().length < 8}>
                Build my plan
              </Button>
            </div>
          </form>
          <p className="card-footnote">
            This sends your description to the HumanLoop server only. {health.mode === 'live' ? `Live model: ${health.model}.` : 'Demo mode is on, so a local sample plan is generated instead of calling a model.'}
          </p>
        </section>

        <FocusChart stats={stats} onStartFocus={() => navigate('focus')} />
      </div>

      <div className="grid-overview-bottom">
        <section className="card" aria-labelledby="activity-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">Audit trail</p>
              <h2 id="activity-title" className="card-title">
                Recent activity
              </h2>
            </div>
            <span className="card-meta">{state.activities.length} events</span>
          </div>
          <ActivityFeed activities={activities} />
        </section>

        <section className="card load-card" aria-labelledby="load-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">Open work</p>
              <h2 id="load-title" className="card-title">
                Where the weight sits
              </h2>
            </div>
            <Badge tone={stats.overdue > 0 ? 'overdue' : 'neutral'}>
              {stats.overdue > 0 ? `${stats.overdue} overdue` : 'On track'}
            </Badge>
          </div>

          <div className="priority-bars">
            {['High', 'Medium', 'Low'].map((priority) => {
              const count = stats.priorityOpen[priority] || 0;
              const max = Math.max(1, ...Object.values(stats.priorityOpen));
              return (
                <div key={priority} className="priority-bar">
                  <div className="priority-bar-head">
                    <span className={`priority-dot priority-${priority.toLowerCase()}`} aria-hidden="true" />
                    <span>{priority}</span>
                    <strong>{count}</strong>
                  </div>
                  <div className="meter meter-soft">
                    <span className={`meter-${priority.toLowerCase()}`} style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="load-summary">
            <div>
              <span className="figure-label">Best next block</span>
              <strong>{next[0] ? `${formatDuration(next[0].durationMinutes)} · ${next[0].title}` : 'Nothing queued'}</strong>
            </div>
            <div>
              <span className="figure-label">Last activity</span>
              <strong>{state.activities[0] ? timeAgo(state.activities[0].at) : 'No activity yet'}</strong>
            </div>
          </div>

          <div className="load-actions">
            <Button size="sm" variant="secondary" icon="tasks" onClick={() => navigate('tasks')}>
              Review tasks
            </Button>
            <Button size="sm" variant="ghost" icon="reflection" onClick={() => navigate('reflection')}>
              Reflect on today
            </Button>
          </div>
        </section>
      </div>

      <AdaptiveAssistant open={adaptiveOpen} onClose={() => setAdaptiveOpen(false)} />
    </div>
  );
}
