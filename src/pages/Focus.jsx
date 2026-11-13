import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Icon } from '../components/Icons.jsx';
import {
  Badge,
  Button,
  DueBadge,
  EmptyState,
  PageHeader,
  PriorityBadge,
  ProgressRing,
  Select,
} from '../components/ui.jsx';
import { AdaptiveAssistant } from '../components/AdaptiveAssistant.jsx';
import { formatClock, formatDueDate, formatDuration, timeAgo, todayISO } from '../lib/fmt.js';
import { getNextTasks } from '../lib/stats.js';

export default function Focus({ initialTaskId, navigate, onStartFocus }) {
  const {
    state,
    stats,
    timer,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    extendTimer,
    logSession,
    completeTask,
    toast,
  } = useApp();

  const [selectedId, setSelectedId] = useState(initialTaskId || '');
  const [preset, setPreset] = useState(state.profile.focusMinutes);
  const [now, setNow] = useState(() => Date.now());
  const loggedRuns = useRef(new Set());

  const openTasks = useMemo(() => state.tasks.filter((task) => task.status !== 'done'), [state.tasks]);
  const queue = useMemo(() => getNextTasks(state.tasks, 4), [state.tasks]);
  const todaySessions = useMemo(
    () => state.sessions.filter((session) => session.date === todayISO()).slice(0, 6),
    [state.sessions],
  );

  useEffect(() => {
    if (initialTaskId) setSelectedId(initialTaskId);
  }, [initialTaskId]);

  useEffect(() => {
    if (timer) return;
    if (!openTasks.some((task) => task.id === selectedId)) {
      setSelectedId(openTasks[0]?.id || '');
    }
  }, [openTasks, selectedId, timer]);

  useEffect(() => {
    if (!timer?.runningSince) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [timer?.runningSince]);

  useEffect(() => {
    setNow(Date.now());
  }, [timer?.runningSince, timer?.elapsedSeconds, timer?.plannedMinutes]);

  const timerTask = timer?.taskId ? state.tasks.find((task) => task.id === timer.taskId) : null;
  const selectedTask = openTasks.find((task) => task.id === selectedId) || null;
  const activeTask = timer
    ? timerTask || {
        id: timer.taskId,
        title: timer.taskTitle || 'Focus session',
        priority: 'Medium',
        durationMinutes: timer.plannedMinutes,
        dueDate: '',
        doneCriteria: '',
        description: 'This task is no longer in the workspace, but the session is still valid.',
      }
    : selectedTask;

  const elapsed = timer
    ? Math.max(0, (timer.elapsedSeconds || 0) + (timer.runningSince ? (now - timer.runningSince) / 1000 : 0))
    : 0;
  const plannedSeconds = (timer?.plannedMinutes || preset) * 60;
  const remaining = timer ? Math.max(0, plannedSeconds - elapsed) : plannedSeconds;
  const progress = plannedSeconds > 0 ? Math.min(100, (elapsed / plannedSeconds) * 100) : 0;
  const finished = Boolean(timer) && remaining <= 0 && !timer?.runningSince;

  useEffect(() => {
    if (!timer?.runningSince) return;
    if (remaining > 0) return;
    pauseTimer();
    if (loggedRuns.current.has(timer.startedAt)) return;
    loggedRuns.current.add(timer.startedAt);
    logSession({
      taskId: timer.taskId,
      taskTitle: timer.taskTitle,
      minutes: timer.plannedMinutes,
      plannedMinutes: timer.plannedMinutes,
      completed: true,
    });
    toast(`Time’s up — ${timer.plannedMinutes} focused minutes logged.`, 'success');
  }, [remaining, timer, pauseTimer, logSession, toast]);

  const start = () => {
    if (!activeTask?.id) {
      toast('Choose a task before starting the timer.', 'error');
      return;
    }
    startTimer({ taskId: activeTask.id, taskTitle: activeTask.title, minutes: preset });
    toast(`${preset}-minute session started. Leave this page if you need to — the timer keeps running.`, 'default');
  };

  const endSession = () => {
    if (!timer) return;
    const minutes = Math.round(elapsed / 60);
    const alreadyLogged = loggedRuns.current.has(timer.startedAt);
    if (minutes >= 1 && !alreadyLogged) {
      loggedRuns.current.add(timer.startedAt);
      logSession({
        taskId: timer.taskId,
        taskTitle: timer.taskTitle,
        minutes,
        plannedMinutes: timer.plannedMinutes,
        completed: false,
      });
      toast(`Logged ${minutes} focused minute${minutes === 1 ? '' : 's'} on “${timer.taskTitle || 'this session'}”.`, 'success');
    } else if (alreadyLogged) {
      toast('That session was already logged.', 'default');
    } else {
      toast('Under a minute was not logged. Only real time counts here.', 'default');
    }
    resetTimer();
    setPreset(state.profile.focusMinutes);
  };

  const finishTask = () => {
    const target = timer?.taskId ? state.tasks.find((task) => task.id === timer.taskId) : activeTask;
    if (!target?.id) {
      toast('There is no task to complete.', 'error');
      return;
    }
    if (timer) {
      const minutes = Math.round(elapsed / 60);
      if (minutes >= 1 && !loggedRuns.current.has(timer.startedAt)) {
        loggedRuns.current.add(timer.startedAt);
        logSession({
          taskId: timer.taskId,
          taskTitle: timer.taskTitle,
          minutes,
          plannedMinutes: timer.plannedMinutes,
          completed: true,
        });
      }
      resetTimer();
    }
    completeTask(target.id);
    setPreset(state.profile.focusMinutes);
    toast(`Completed “${target.title}”. The next task is ready when you are.`, 'success');
  };

  const selectTask = (taskId) => {
    if (timer) {
      toast('Finish or end the current session before switching tasks.', 'error');
      return;
    }
    setSelectedId(taskId);
  };

  const presets = [...new Set([15, state.profile.focusMinutes, 25, 45, 60])].sort((a, b) => a - b);

  if (openTasks.length === 0 && !timer) {
    return (
      <div className="stack">
        <PageHeader
          eyebrow="Deep work"
          title="Focus Mode"
          description="One task, one timer, no dashboard noise. Focus sessions are logged only when the clock actually runs."
          actions={
            <Button icon="tasks" onClick={() => navigate('tasks')}>
              Open My Tasks
            </Button>
          }
        />
        <div className="card">
          <EmptyState
            icon="focus"
            title="Nothing to focus on yet"
            body="Focus Mode needs a real open task. Add one by hand, or let the Clarity Engine turn your situation into a short plan."
            action={
              <div className="empty-actions">
                <Button variant="primary" icon="clarity" onClick={() => navigate('clarity')}>
                  Build a plan
                </Button>
                <Button icon="tasks" onClick={() => navigate('tasks')}>
                  Add a task
                </Button>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Deep work"
        title="Focus Mode"
        description="One task, one timer. The plan can change later; for the next block it does not get a vote."
        actions={
          <>
            <Button icon="tasks" variant="ghost" onClick={() => navigate('tasks')}>
              View tasks
            </Button>
            <Badge tone={timer?.runningSince ? 'accent' : 'neutral'} dot>
              {timer?.runningSince ? 'Session live' : finished ? 'Session complete' : timer ? 'Session paused' : 'Timer idle'}
            </Badge>
          </>
        }
      />

      <div className="grid-focus">
        <div className="focus-main">
          <section className={`card timer-card ${timer?.runningSince ? 'is-running' : ''}`} aria-labelledby="focus-title">
            <div className="timer-card-head">
              <div className="timer-context">
                <span className="eyebrow">Now focusing</span>
                {activeTask ? (
                  <div className="timer-task-meta">
                    <PriorityBadge priority={activeTask.priority} />
                    {activeTask.dueDate ? <DueBadge due={formatDueDate(activeTask.dueDate)} /> : null}
                    <span className="card-meta">Session {stats.sessionsToday + 1} today</span>
                  </div>
                ) : null}
              </div>
              {!timer && queue.length > 0 ? (
                <label className="inline-select">
                  <span>Task</span>
                  <Select value={selectedId} onChange={(event) => selectTask(event.target.value)} aria-label="Task for this focus session">
                    {openTasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : null}
            </div>

            <h2 id="focus-title" className="focus-task-title">
              {activeTask?.title || 'Choose a task'}
            </h2>
            {activeTask?.description ? <p className="focus-task-desc">{activeTask.description}</p> : null}

            {activeTask?.doneCriteria ? (
              <div className="done-when">
                <span>
                  <Icon name="check" size={13} /> Done when
                </span>
                <p>{activeTask.doneCriteria}</p>
              </div>
            ) : null}

            <div className="timer-stage">
              <ProgressRing
                value={progress}
                size={248}
                stroke={10}
                label={formatClock(remaining)}
                sublabel={`${formatDuration(timer?.plannedMinutes || preset)} session`}
                className="ring-timer"
              />
              <div className="timer-side">
                <div className="timer-stat">
                  <span className="stat-label">Elapsed</span>
                  <strong>{formatClock(elapsed)}</strong>
                </div>
                <div className="timer-stat">
                  <span className="stat-label">Remaining</span>
                  <strong>{formatClock(remaining)}</strong>
                </div>
                <div className="timer-stat">
                  <span className="stat-label">Estimate</span>
                  <strong>{formatDuration(activeTask?.durationMinutes || preset)}</strong>
                </div>
                <div className="mode-inline">
                  <span className={`status-dot status-${timer?.runningSince ? 'live' : 'demo'}`} aria-hidden="true" />
                  {timer?.runningSince ? 'Counting down' : timer ? 'Paused' : 'Ready'}
                </div>
              </div>
            </div>

            {finished ? (
              <div className="timer-finished" role="status">
                <Icon name="check" size={16} />
                <div>
                  <strong>Block finished.</strong>
                  <p>
                    {timer?.plannedMinutes} minutes are logged. Mark the task done only if it actually is — otherwise start a smaller
                    slice.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="timer-controls">
              {!timer ? (
                <>
                  <div className="preset-row" role="group" aria-label="Session length">
                    {presets.map((minutes) => (
                      <button
                        key={minutes}
                        type="button"
                        className={`preset ${preset === minutes ? 'is-active' : ''}`}
                        onClick={() => setPreset(minutes)}
                        aria-pressed={preset === minutes}
                      >
                        {minutes}m
                      </button>
                    ))}
                  </div>
                  <Button variant="primary" size="lg" icon="play" onClick={start}>
                    Start {preset}-minute session
                  </Button>
                </>
              ) : (
                <>
                  {timer.runningSince ? (
                    <Button variant="primary" size="lg" icon="pause" onClick={pauseTimer}>
                      Pause
                    </Button>
                  ) : remaining > 0 ? (
                    <Button variant="primary" size="lg" icon="play" onClick={resumeTimer}>
                      Resume
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="lg"
                      icon="play"
                      onClick={() =>
                        startTimer({
                          taskId: activeTask?.id || null,
                          taskTitle: activeTask?.title || '',
                          minutes: preset,
                        })
                      }
                      disabled={!activeTask?.id}
                    >
                      Start another block
                    </Button>
                  )}
                  <Button icon="plus" onClick={() => extendTimer(5)}>
                    +5 min
                  </Button>
                  <Button icon="rotate" onClick={endSession}>
                    End &amp; log
                  </Button>
                </>
              )}
            </div>

            <div className="timer-foot">
              <Button
                variant="secondary"
                icon="check"
                onClick={finishTask}
                disabled={!activeTask?.id}
              >
                Mark task complete
              </Button>
              <p>
                Sessions are logged with real elapsed time. The timer survives moving between pages, but a page reload resets it.
              </p>
            </div>
          </section>

          <section className="card sessions-card" aria-labelledby="sessions-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Audit trail</p>
                <h2 id="sessions-title" className="card-title">
                  Today’s sessions
                </h2>
              </div>
              <span className="card-meta">
                {formatDuration(stats.focusMinutesToday)} · {stats.sessionsToday} session{stats.sessionsToday === 1 ? '' : 's'}
              </span>
            </div>
            {todaySessions.length === 0 ? (
              <EmptyState
                compact
                icon="focus"
                title="No sessions logged today"
                body="Start the timer above. Only time that actually passes is recorded."
              />
            ) : (
              <ul className="session-list">
                {todaySessions.map((session) => (
                  <li key={session.id} className="session-item">
                    <span className="session-minutes">{session.minutes}m</span>
                    <div>
                      <p>{session.taskTitle}</p>
                      <span className="session-meta">
                        {timeAgo(session.endedAt)} · {session.completed ? 'completed' : 'ended early'}
                      </span>
                    </div>
                    <span className="session-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, (session.minutes / Math.max(1, session.plannedMinutes || session.minutes)) * 100)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="focus-side">
          <section className="card queue-card" aria-labelledby="queue-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">After this</p>
                <h2 id="queue-title" className="card-title">
                  Queue
                </h2>
              </div>
              <span className="card-meta">{openTasks.length} open</span>
            </div>
            {queue.length === 0 ? (
              <EmptyState compact icon="check" title="Queue clear" body="Nothing else is open. Decide what tomorrow deserves before adding more." />
            ) : (
              <ul className="queue-list">
                {queue.map((task, index) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className={`queue-item ${task.id === selectedId && !timer ? 'is-current' : ''}`}
                      onClick={() => selectTask(task.id)}
                      title={timer ? 'Finish the current session first' : `Select “${task.title}”`}
                    >
                      <span className="queue-rank">{String(index + 1).padStart(2, '0')}</span>
                      <span className="queue-main">
                        <span className="queue-title">{task.title}</span>
                        <span className="queue-meta">
                          {task.priority} · {formatDuration(task.durationMinutes)}
                          {task.dueDate ? ` · ${formatDueDate(task.dueDate).label}` : ''}
                        </span>
                      </span>
                      {task.id === selectedId && !timer ? <Icon name="target" size={15} /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="text-btn queue-link" onClick={() => navigate('tasks')}>
              Open the task list instead
            </button>
          </section>

          <AdaptiveAssistant embedded defaultTaskId={activeTask?.id || null} navigate={navigate} onClose={() => {}} />
        </aside>
      </div>
    </div>
  );
}
