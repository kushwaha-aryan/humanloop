import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Icon } from './Icons.jsx';
import { Badge, Button, Select } from './ui.jsx';
import { formatDuration, formatShortDate, todayISO } from '../lib/fmt.js';

const PRIORITIES = ['High', 'Medium', 'Low'];

/**
 * Editable review of an AI plan. Nothing reaches the workspace until the user
 * explicitly adds a task, and titles are deduplicated by the store.
 */
export function PlanReview({ plan, onNavigate }) {
  const { addTasks, toast } = useApp();
  const [items, setItems] = useState(() =>
    (plan.tasks || []).map((task) => ({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'Medium',
      durationMinutes: task.durationMinutes || 25,
      dueDate: task.dueDate || '',
      doneCriteria: task.doneCriteria || '',
      expanded: false,
    })),
  );
  const [added, setAdded] = useState([]);

  const totalMinutes = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.durationMinutes) || 0), 0),
    [items],
  );
  const allAdded = items.length > 0 && added.length >= items.length;
  const valid = items.length > 0 && items.every((item) => item.title.trim().length >= 3);

  const update = (index, patch) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const toInput = (item) => ({
    title: item.title.trim(),
    description: item.description,
    priority: item.priority,
    durationMinutes: Number(item.durationMinutes) || 25,
    dueDate: item.dueDate,
    doneCriteria: item.doneCriteria,
    source: 'plan',
  });

  const addOne = (index) => {
    const item = items[index];
    if (!item || item.title.trim().length < 3) {
      toast('Give this task a title of at least three characters first.', 'error');
      return;
    }
    addTasks([toInput(item)]);
    setAdded((current) => (current.includes(index) ? current : [...current, index]));
    toast('Task added to your workspace.', 'success');
  };

  const addAll = () => {
    if (!valid) {
      toast('Every task needs a title before the plan can be added.', 'error');
      return;
    }
    addTasks(items.map(toInput));
    setAdded(items.map((_, index) => index));
    toast('Plan added to your workspace. Duplicate titles were skipped.', 'success');
  };

  if (items.length === 0) {
    return (
      <p className="plan-empty">The plan came back without usable tasks. Try describing the situation again with a little more detail.</p>
    );
  }

  return (
    <div className="plan">
      <div className="plan-head">
        <div>
          <span className="plan-kicker">Suggested plan</span>
          <h3 className="plan-headline">{plan.headline}</h3>
        </div>
        <Badge tone="neutral">{formatDuration(totalMinutes)} total</Badge>
      </div>

      {plan.understanding ? <p className="plan-understanding">{plan.understanding}</p> : null}

      {plan.blockers?.length > 0 ? (
        <div className="blockers">
          <span className="blockers-label">
            <Icon name="alert" size={14} /> Watch for
          </span>
          <div className="blockers-list">
            {plan.blockers.map((blocker) => (
              <Badge key={blocker} tone="neutral">
                {blocker}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className="plan-tasks">
        {items.map((item, index) => {
          const isAdded = added.includes(index);
          return (
            <article key={index} className={`plan-task ${isAdded ? 'is-added' : ''}`}>
              <div className="plan-task-head">
                <span className="plan-index">{String(index + 1).padStart(2, '0')}</span>
                <input
                  className="plan-title-input"
                  value={item.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                  aria-label={`Title for task ${index + 1}`}
                  maxLength={160}
                  disabled={isAdded}
                />
                <Select
                  className="select-sm"
                  value={item.priority}
                  onChange={(event) => update(index, { priority: event.target.value })}
                  aria-label={`Priority for task ${index + 1}`}
                  disabled={isAdded}
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </Select>
                {!isAdded ? (
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm"
                    onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                    aria-label={`Remove task ${index + 1} from the plan`}
                  >
                    <Icon name="x" size={14} />
                  </button>
                ) : (
                  <span className="added-mark" aria-label="Added to workspace">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </div>

              <div className="plan-task-meta">
                <label className="mini-field">
                  <span>Estimate</span>
                  <span className="mini-input">
                    <input
                      type="number"
                      min="5"
                      max="240"
                      step="5"
                      value={item.durationMinutes}
                      onChange={(event) => update(index, { durationMinutes: event.target.value })}
                      aria-label={`Estimated minutes for task ${index + 1}`}
                      disabled={isAdded}
                    />
                    <span className="mini-suffix">min</span>
                  </span>
                </label>
                <label className="mini-field">
                  <span>Deadline</span>
                  <input
                    type="date"
                    value={item.dueDate}
                    min={todayISO()}
                    onChange={(event) => update(index, { dueDate: event.target.value })}
                    aria-label={`Deadline for task ${index + 1}`}
                    disabled={isAdded}
                  />
                </label>
                <span className="mini-note">Due {item.dueDate ? formatShortDate(item.dueDate, false) : 'not set'}</span>
              </div>

              {item.expanded ? (
                <div className="plan-task-details">
                  <label className="mini-field mini-field-block">
                    <span>How to do it</span>
                    <textarea
                      className="input textarea"
                      rows={2}
                      value={item.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      disabled={isAdded}
                      maxLength={800}
                    />
                  </label>
                  <label className="mini-field mini-field-block">
                    <span>Done when</span>
                    <textarea
                      className="input textarea"
                      rows={2}
                      value={item.doneCriteria}
                      onChange={(event) => update(index, { doneCriteria: event.target.value })}
                      disabled={isAdded}
                      maxLength={400}
                    />
                  </label>
                </div>
              ) : (
                <p className="plan-task-summary">{item.description}</p>
              )}

              <div className="plan-task-foot">
                <button type="button" className="text-btn" onClick={() => update(index, { expanded: !item.expanded })}>
                  {item.expanded ? 'Hide details' : 'Edit details'}
                </button>
                <Button
                  size="sm"
                  variant={isAdded ? 'ghost' : 'secondary'}
                  icon={isAdded ? 'check' : 'plus'}
                  onClick={() => addOne(index)}
                  disabled={isAdded}
                >
                  {isAdded ? 'Added' : 'Add task'}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="plan-footer">
        <p className="plan-footer-note">
          {allAdded ? 'Everything in this plan is in your workspace.' : 'Edit titles, estimates and deadlines before adding. Nothing is saved until you add it.'}
        </p>
        <div className="plan-footer-actions">
          {allAdded && onNavigate ? (
            <Button size="sm" variant="primary" iconRight="arrowRight" onClick={() => onNavigate('tasks')}>
              Open My Tasks
            </Button>
          ) : (
            <Button size="sm" variant="primary" icon="plus" onClick={addAll} disabled={!valid || allAdded}>
              Add {items.length} task{items.length === 1 ? '' : 's'} to workspace
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
