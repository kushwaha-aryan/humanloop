import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { requestReflection } from '../lib/api.js';
import { addDaysISO, formatDuration, formatShortDate, timeAgo, toISODate, todayISO } from '../lib/fmt.js';
import { Badge, Button, ConfirmDialog, EmptyState, Field, InlineError, PageHeader, Skeleton, Textarea } from '../components/ui.jsx';
import { Icon } from '../components/Icons.jsx';

const EMPTY_INPUT = { accomplished: '', unfinished: '', blockers: '', nextPriority: '' };

export default function Reflection({ navigate, health }) {
  const { state, stats, addReflection, addTask, deleteReflection, toast } = useApp();
  const [form, setForm] = useState(EMPTY_INPUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [addedSteps, setAddedSteps] = useState([]);

  const latest = state.reflections[0] || null;
  const completedToday = useMemo(
    () => stats.doneTasks.filter((task) => task.completedAt && toISODate(new Date(task.completedAt)) === todayISO()),
    [stats.doneTasks],
  );

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const statsForApi = {
    completedToday: stats.completedToday,
    createdToday: stats.createdToday,
    focusMinutesToday: stats.focusMinutesToday,
    sessionsToday: stats.sessionsToday,
    openTasks: stats.pending,
  };

  const submit = async (event) => {
    event?.preventDefault?.();
    if (form.accomplished.trim().length < 8) {
      toast('Write at least a sentence about what you actually did. Partial progress counts.', 'error');
      return;
    }
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const data = await requestReflection({ input: form, stats: statsForApi, tasks: state.tasks });
      addReflection({ input: form, result: data.result, mode: data.mode });
      setForm(EMPTY_INPUT);
      setAddedSteps([]);
      toast(data.mode === 'demo' ? 'Reflection saved (demo sample).' : 'Reflection saved.', 'success');
    } catch (requestError) {
      setError(requestError.message || 'The reflection request failed.');
    } finally {
      setLoading(false);
    }
  };

  const insertCompleted = () => {
    if (completedToday.length === 0) return;
    const lines = completedToday.map((task) => `- ${task.title}`).join('\n');
    set('accomplished', [form.accomplished.trim(), lines].filter(Boolean).join('\n'));
  };

  const addStepAsTask = (step, index) => {
    const task = addTask({
      title: step.title,
      description: step.why,
      priority: 'High',
      durationMinutes: 25,
      dueDate: addDaysISO(todayISO(), 1),
      doneCriteria: 'The task is visibly finished and the result is saved.',
      source: 'ai',
    });
    if (task) {
      setAddedSteps((current) => [...current, index]);
      toast(`Added “${step.title}” for tomorrow.`, 'success');
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Close the loop"
        title="Daily reflection"
        description="End the day with the truth, not a scorecard. The reflection names what moved, what stalled, and the one action that deserves tomorrow."
        actions={
          <>
            <Badge tone={health.mode === 'live' ? 'accent' : 'neutral'} dot>
              {health.mode === 'live' ? 'Live AI' : 'Demo sample'}
            </Badge>
            <Button icon="overview" variant="ghost" onClick={() => navigate('overview')}>
              Back to overview
            </Button>
          </>
        }
      />

      <div className="grid-reflection">
        <section className="card reflection-form-card" aria-labelledby="reflect-title">
          <div className="card-head">
            <div>
              <p className="eyebrow">Four honest answers</p>
              <h2 id="reflect-title" className="card-title">
                What actually happened today?
              </h2>
            </div>
          </div>

          <form className="form-stack" onSubmit={submit}>
            <Field
              label="What did you get done?"
              htmlFor="reflect-accomplished"
              hint="Partial progress counts. Avoid grading yourself — describe output."
            >
              <Textarea
                id="reflect-accomplished"
                rows={4}
                value={form.accomplished}
                onChange={(event) => set('accomplished', event.target.value)}
                maxLength={1500}
                placeholder="Finished the first section of the report, sent two overdue replies, cleared the kitchen."
                required
              />
            </Field>
            {completedToday.length > 0 ? (
              <button type="button" className="text-btn inline-insert" onClick={insertCompleted}>
                <Icon name="plus" size={13} /> Insert {completedToday.length} task{completedToday.length === 1 ? '' : 's'} completed today
              </button>
            ) : null}

            <Field label="What is still unfinished?" htmlFor="reflect-unfinished" optional hint="Name it so it stops circling in your head overnight.">
              <Textarea
                id="reflect-unfinished"
                rows={3}
                value={form.unfinished}
                onChange={(event) => set('unfinished', event.target.value)}
                maxLength={1500}
                placeholder="The second half of the report. The tax form. The message I keep rewriting."
              />
            </Field>

            <Field label="What blocked you?" htmlFor="reflect-blockers" optional hint="A blocker is a fact: missing information, no time, waiting on someone.">
              <Textarea
                id="reflect-blockers"
                rows={3}
                value={form.blockers}
                onChange={(event) => set('blockers', event.target.value)}
                maxLength={1500}
                placeholder="I did not know what the client wanted, so I kept rewriting the opening instead of asking."
              />
            </Field>

            <Field label="What should come first next?" htmlFor="reflect-next" optional hint="One thing. If everything is first, nothing is.">
              <Textarea
                id="reflect-next"
                rows={2}
                value={form.nextPriority}
                onChange={(event) => set('nextPriority', event.target.value)}
                maxLength={1500}
                placeholder="Send the client three questions, then finish the draft with the answers."
              />
            </Field>

            {error ? <InlineError message={error} onRetry={submit} retryLabel="Generate the reflection again" /> : null}

            <div className="reflection-submit">
              <Button variant="primary" icon="reflection" type="submit" loading={loading} disabled={loading || form.accomplished.trim().length < 8}>
                {loading ? 'Writing the reflection' : 'Generate my reflection'}
              </Button>
              <button type="button" className="text-btn" onClick={() => setForm(EMPTY_INPUT)} disabled={loading}>
                Clear form
              </button>
            </div>
            {loading ? <Skeleton lines={2} /> : null}
            <p className="card-footnote">Measured activity for today is sent with your answers. Nothing is invented on the dashboard.</p>
          </form>
        </section>

        <aside className="reflection-side">
          <section className="card numbers-card" aria-labelledby="numbers-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Measured today</p>
                <h2 id="numbers-title" className="card-title">
                  The real numbers
                </h2>
              </div>
            </div>
            <dl className="numbers-grid">
              <div>
                <dt>Tasks closed</dt>
                <dd>{stats.completedToday}</dd>
              </div>
              <div>
                <dt>Tasks added</dt>
                <dd>{stats.createdToday}</dd>
              </div>
              <div>
                <dt>Focus time</dt>
                <dd>{formatDuration(stats.focusMinutesToday)}</dd>
              </div>
              <div>
                <dt>Sessions</dt>
                <dd>{stats.sessionsToday}</dd>
              </div>
              <div>
                <dt>Still open</dt>
                <dd>{stats.pending}</dd>
              </div>
              <div>
                <dt>Overdue</dt>
                <dd className={stats.overdue ? 'is-alert' : ''}>{stats.overdue}</dd>
              </div>
            </dl>
            <p className="context-note">
              These counts come from your workspace and focus log. If nothing was completed, the page says zero.
            </p>
          </section>

          <section className="card latest-card" aria-labelledby="latest-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Latest reflection</p>
                <h2 id="latest-title" className="card-title">
                  {latest ? formatShortDate(latest.createdAt) : 'Nothing yet'}
                </h2>
              </div>
              {latest ? <Badge tone={latest.mode === 'live' ? 'accent' : 'neutral'}>{latest.mode === 'live' ? 'Live AI' : 'Demo sample'}</Badge> : null}
            </div>

            {!latest ? (
              <EmptyState
                compact
                icon="reflection"
                title="No reflection recorded"
                body="Fill in the four answers and generate one. It is saved locally so you can look back without an account."
              />
            ) : (
              <div className="reflection-result">
                <h3 className="reflection-headline">{latest.result.headline}</h3>
                <p className="reflection-body">{latest.result.reflection}</p>

                {latest.result.wins?.length > 0 ? (
                  <div className="reflection-block">
                    <h4>What moved</h4>
                    <ul className="tick-list">
                      {latest.result.wins.map((win) => (
                        <li key={win}>
                          <Icon name="check" size={13} />
                          <span>{win}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="reflection-block">
                  <h4>Start tomorrow with</h4>
                  <ul className="next-steps">
                    {latest.result.nextSteps.map((step, index) => (
                      <li key={`${step.title}-${index}`}>
                        <div>
                          <p>{step.title}</p>
                          <span>{step.why}</span>
                        </div>
                        <Button
                          size="sm"
                          variant={addedSteps.includes(index) ? 'ghost' : 'secondary'}
                          icon={addedSteps.includes(index) ? 'check' : 'plus'}
                          onClick={() => addStepAsTask(step, index)}
                          disabled={addedSteps.includes(index)}
                        >
                          {addedSteps.includes(index) ? 'Added' : 'Add task'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>

      <section className="card history-card" aria-labelledby="history-title">
        <div className="card-head">
          <div>
            <p className="eyebrow">Local history</p>
            <h2 id="history-title" className="card-title">
              Past reflections
            </h2>
          </div>
          <span className="card-meta">
            {state.reflections.length} saved · {stats.streak.days}-day streak
          </span>
        </div>

        {state.reflections.length === 0 ? (
          <EmptyState
            compact
            icon="reflection"
            title="Your history starts with today"
            body="Reflections are stored in this browser. They are not sent anywhere except the AI request that generates them."
          />
        ) : (
          <ul className="history-list">
            {state.reflections.map((entry) => (
              <li key={entry.id} className="history-item">
                <details>
                  <summary>
                    <span className="history-date">{formatShortDate(entry.createdAt)}</span>
                    <span className="history-headline">{entry.result.headline}</span>
                    <Badge tone={entry.mode === 'live' ? 'neutral' : 'neutral'}>{entry.mode === 'live' ? 'Live AI' : 'Demo'}</Badge>
                    <span className="history-ago">{timeAgo(entry.createdAt)}</span>
                    <Icon name="chevronDown" size={15} className="history-chevron" />
                  </summary>
                  <div className="history-body">
                    <p className="reflection-body">{entry.result.reflection}</p>
                    {entry.result.wins?.length > 0 ? (
                      <ul className="tick-list">
                        {entry.result.wins.map((win) => (
                          <li key={win}>
                            <Icon name="check" size={13} />
                            <span>{win}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="history-inputs">
                      <div>
                        <span>Accomplished</span>
                        <p>{entry.input.accomplished || '—'}</p>
                      </div>
                      <div>
                        <span>Still open</span>
                        <p>{entry.input.unfinished || '—'}</p>
                      </div>
                      <div>
                        <span>Blocker</span>
                        <p>{entry.input.blockers || '—'}</p>
                      </div>
                      <div>
                        <span>Next priority</span>
                        <p>{entry.input.nextPriority || '—'}</p>
                      </div>
                    </div>
                    <div className="history-actions">
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => setPendingDelete(entry)}>
                        Delete reflection
                      </Button>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this reflection?"
        message="The reflection and the answers you wrote for it will be removed from this browser."
        confirmLabel="Delete reflection"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteReflection(pendingDelete.id);
            toast('Reflection deleted.', 'default');
          }
        }}
      />
    </div>
  );
}
