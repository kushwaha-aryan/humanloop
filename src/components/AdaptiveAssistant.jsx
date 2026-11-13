import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { requestAdaptation, SIGNAL_OPTIONS } from '../lib/api.js';
import { formatDuration, formatShortDate } from '../lib/fmt.js';
import { Badge, Button, InlineError, Modal, Select, Skeleton, Textarea } from './ui.jsx';
import { Icon } from './Icons.jsx';

const ACTION_LABELS = {
  reschedule: 'Reschedule',
  reduce_scope: 'Reduce scope',
  split: 'Split',
  defer: 'Defer',
  drop: 'Remove',
  complete: 'Complete',
  add: 'New task',
  keep: 'No change',
};

function describeChange(adjustment) {
  const parts = [];
  if (adjustment.durationMinutes) parts.push(`→ ${adjustment.durationMinutes} min`);
  if (adjustment.priority) parts.push(`→ ${adjustment.priority} priority`);
  if (adjustment.dueDate) parts.push(`→ due ${formatShortDate(adjustment.dueDate, false)}`);
  return parts;
}

export function AdaptiveAssistant({ open = false, onClose, embedded = false, defaultTaskId = null, navigate }) {
  const { state, completeTask, updateTask, deleteTask, addTask, startTimer, toast } = useApp();
  const openTasks = useMemo(() => state.tasks.filter((task) => task.status !== 'done'), [state.tasks]);
  const [signal, setSignal] = useState('less_time');
  const [note, setNote] = useState('');
  const [completedTaskId, setCompletedTaskId] = useState(defaultTaskId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('demo');
  const [applied, setApplied] = useState([]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
    setApplied([]);
  }, [open]);

  useEffect(() => {
    if (!completedTaskId && openTasks[0]) setCompletedTaskId(defaultTaskId || openTasks[0].id);
  }, [completedTaskId, defaultTaskId, openTasks]);

  const selectedSignal = SIGNAL_OPTIONS.find((option) => option.id === signal);

  const taskTitle = (taskId) => state.tasks.find((task) => task.id === taskId)?.title || 'that task';

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied([]);

    let tasksForRequest = state.tasks;
    if (signal === 'completed' && completedTaskId) {
      const target = state.tasks.find((task) => task.id === completedTaskId);
      if (target && target.status !== 'done') {
        completeTask(target.id);
        tasksForRequest = state.tasks.map((task) =>
          task.id === target.id ? { ...task, status: 'done', completedAt: new Date().toISOString() } : task,
        );
      }
    }

    try {
      const data = await requestAdaptation({ signal, note: note.trim(), tasks: tasksForRequest });
      setResult(data.result);
      setMode(data.mode);
    } catch (requestError) {
      setError(requestError.message || 'The replan request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyAdjustment = (adjustment, index) => {
    if (applied.includes(index)) return;
    try {
      if (adjustment.action === 'add') {
        const task = addTask({
          title: adjustment.title,
          description: adjustment.description,
          priority: adjustment.priority,
          durationMinutes: adjustment.durationMinutes,
          dueDate: adjustment.dueDate,
          doneCriteria: adjustment.doneCriteria,
          source: 'ai',
        });
        if (!task) throw new Error('Task could not be created.');
      } else if (adjustment.action === 'drop') {
        if (adjustment.taskId) deleteTask(adjustment.taskId);
      } else if (adjustment.action === 'complete') {
        if (adjustment.taskId) completeTask(adjustment.taskId);
      } else if (adjustment.action !== 'keep' && adjustment.taskId) {
        const patch = {};
        for (const key of ['priority', 'durationMinutes', 'dueDate', 'title', 'description', 'doneCriteria']) {
          if (adjustment[key] !== undefined) patch[key] = adjustment[key];
        }
        updateTask(adjustment.taskId, patch);
      }

      setApplied((current) => [...current, index]);
      toast(
        adjustment.action === 'keep'
          ? 'Context noted. No task change was needed.'
          : adjustment.action === 'drop'
            ? `Removed “${taskTitle(adjustment.taskId)}”.`
            : adjustment.action === 'complete'
              ? `Marked “${taskTitle(adjustment.taskId)}” complete.`
              : `Applied: ${ACTION_LABELS[adjustment.action] || 'change'}.`,
        'success',
      );
    } catch {
      toast('That change could not be applied. The task may have been deleted.', 'error');
    }
  };

  const applyAll = () => {
    if (!result) return;
    result.adjustments.forEach((adjustment, index) => {
      if (!applied.includes(index)) applyAdjustment(adjustment, index);
    });
  };

  const startNextAction = () => {
    if (!result) return;
    const match = state.tasks.find(
      (task) => task.status !== 'done' && task.title.toLowerCase() === result.nextAction.title.toLowerCase(),
    );
    startTimer({
      taskId: match?.id || null,
      taskTitle: result.nextAction.title,
      minutes: result.nextAction.durationMinutes,
    });
    toast(`Started a ${result.nextAction.durationMinutes}-minute block.`, 'success');
    onClose?.();
    if (!embedded) {
      if (navigate) navigate('focus');
      else window.location.hash = '#/focus';
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setApplied([]);
  };

  const contextCount = openTasks.length;

  const body = (
    <div className="adaptive">
      {embedded ? (
        <div className="adaptive-head">
          <div>
            <p className="eyebrow">Plans change</p>
            <h2 className="card-title">Something came up?</h2>
          </div>
          <span className="ai-mark" aria-hidden="true">
            <Icon name="rotate" size={15} />
          </span>
        </div>
      ) : null}

      {!result ? (
        <>
          <p className="adaptive-lede">
            Tell HumanLoop what changed. It reads your open tasks and returns a revised plan instead of a pep talk.
          </p>

          <div className="signal-grid" role="radiogroup" aria-label="What changed?">
            {SIGNAL_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={signal === option.id}
                className={`signal-btn ${signal === option.id ? 'is-selected' : ''}`}
                onClick={() => setSignal(option.id)}
              >
                <span className="signal-indicator" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <p className="signal-hint">{selectedSignal?.hint}</p>

          {signal === 'completed' ? (
            <label className="mini-field mini-field-block">
              <span>Which task did you finish?</span>
              <Select value={completedTaskId} onChange={(event) => setCompletedTaskId(event.target.value)}>
                {openTasks.length === 0 ? <option value="">No open tasks</option> : null}
                {openTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <label className="mini-field mini-field-block">
            <span>Anything else worth knowing? (optional)</span>
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1200}
              placeholder={
                signal === 'urgent'
                  ? 'e.g. A client call moved to 3pm and I still need the deck.'
                  : signal === 'less_time'
                    ? 'e.g. I only have 40 minutes before I have to leave.'
                    : 'e.g. I read the brief twice but cannot pick a starting point.'
              }
            />
          </label>

          <p className="adaptive-context">
            <Icon name="layers" size={14} /> Sending {contextCount} open task{contextCount === 1 ? '' : 's'} as context: titles, priorities,
            estimates, deadlines. Nothing else leaves this browser except your note.
          </p>

          {error ? <InlineError message={error} onRetry={run} retryLabel="Try the replan again" /> : null}

          <div className="adaptive-submit">
            <Button variant="primary" icon="clarity" onClick={run} loading={loading} disabled={loading}>
              {loading ? 'Reworking your plan' : 'Rework my plan'}
            </Button>
            <span className="mode-inline">
              {state.tasks.length === 0 ? 'No tasks yet — a starting task can be created.' : 'Uses your real task state.'}
            </span>
          </div>

          {loading ? (
            <div className="ai-loading">
              <Skeleton lines={2} />
              <p className="ai-loading-note">Reading priorities, checking what can move, and cutting the plan to fit.</p>
            </div>
          ) : null}
        </>
      ) : (
        <div className="adaptive-result">
          <div className="adaptive-result-top">
            <Badge tone="accent">Revised plan</Badge>
            <Badge tone={mode === 'live' ? 'neutral' : 'neutral'}>{mode === 'live' ? 'Live AI' : 'Demo sample'}</Badge>
            <button type="button" className="text-btn adaptive-reset" onClick={reset}>
              Start over
            </button>
          </div>

          <h3 className="adaptive-headline">{result.headline}</h3>
          <p className="adaptive-assessment">{result.assessment}</p>

          <ul className="adjust-list">
            {result.adjustments.map((adjustment, index) => {
              const isApplied = applied.includes(index);
              const changes = describeChange(adjustment);
              const title =
                adjustment.action === 'add'
                  ? adjustment.title
                  : `${taskTitle(adjustment.taskId)}`;
              return (
                <li key={`${adjustment.action}-${index}`} className={`adjust-item ${isApplied ? 'is-applied' : ''}`}>
                  <div className="adjust-top">
                    <Badge tone={adjustment.action === 'drop' ? 'overdue' : adjustment.action === 'add' ? 'accent' : 'neutral'}>
                      {ACTION_LABELS[adjustment.action] || adjustment.action}
                    </Badge>
                    <span className="adjust-title">{title}</span>
                  </div>
                  {changes.length > 0 ? (
                    <div className="adjust-changes">
                      {changes.map((change) => (
                        <span key={change}>{change}</span>
                      ))}
                    </div>
                  ) : null}
                  <p className="adjust-reason">{adjustment.reason}</p>
                  <div className="adjust-foot">
                    {adjustment.action === 'keep' ? (
                      <span className="adjust-noop">No workspace change needed</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={isApplied ? 'ghost' : 'secondary'}
                        icon={isApplied ? 'check' : 'arrowRight'}
                        onClick={() => applyAdjustment(adjustment, index)}
                        disabled={isApplied}
                      >
                        {isApplied ? 'Applied' : adjustment.action === 'drop' ? 'Remove task' : 'Apply'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="next-action">
            <span className="next-action-kicker">
              <Icon name="bolt" size={14} /> Do this next · {formatDuration(result.nextAction.durationMinutes)}
            </span>
            <h4>{result.nextAction.title}</h4>
            <p>{result.nextAction.reason}</p>
            <Button size="sm" variant="primary" icon="play" onClick={startNextAction}>
              Start {result.nextAction.durationMinutes}-minute block
            </Button>
          </div>

          <div className="adaptive-actions">
            <Button variant="secondary" icon="check" onClick={applyAll} disabled={applied.length >= result.adjustments.length}>
              Apply all changes
            </Button>
            <Button variant="ghost" onClick={reset}>
              Adjust differently
            </Button>
            {!embedded ? (
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return <section className="card adaptive-card">{body}</section>;
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Replan with AI"
      description="Use your real task state. The revision is applied only when you choose."
      size="lg"
    >
      {body}
    </Modal>
  );
}
