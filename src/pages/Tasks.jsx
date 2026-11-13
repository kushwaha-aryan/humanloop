import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Icon } from '../components/Icons.jsx';
import {
  Badge,
  Button,
  ConfirmDialog,
  DueBadge,
  EmptyState,
  Input,
  PageHeader,
  PriorityBadge,
  Select,
} from '../components/ui.jsx';
import { TaskEditor } from '../components/TaskEditor.jsx';
import { formatDueDate, formatDuration, timeAgo } from '../lib/fmt.js';
import { PRIORITY_RANK } from '../lib/storage.js';
import { sortTasks } from '../lib/stats.js';

const STATUS_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Completed' },
  { id: 'all', label: 'All' },
];

export default function Tasks({ navigate, onStartFocus }) {
  const { state, stats, completeTask, reopenTask, deleteTask, clearCompleted, toast } = useApp();
  const [status, setStatus] = useState('open');
  const [priority, setPriority] = useState('all');
  const [sort, setSort] = useState('smart');
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState({ open: false, task: null });
  const [pendingDelete, setPendingDelete] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const counts = useMemo(
    () => ({
      open: state.tasks.filter((task) => task.status !== 'done').length,
      done: state.tasks.filter((task) => task.status === 'done').length,
      all: state.tasks.length,
    }),
    [state.tasks],
  );

  const filtered = useMemo(() => {
    let list = [...state.tasks];
    if (status === 'open') list = list.filter((task) => task.status !== 'done');
    if (status === 'done') list = list.filter((task) => task.status === 'done');

    if (priority !== 'all') list = list.filter((task) => task.priority === priority);

    const query = search.trim().toLowerCase();
    if (query) {
      list = list.filter((task) =>
        `${task.title} ${task.description} ${task.doneCriteria}`.toLowerCase().includes(query),
      );
    }

    if (sort === 'due') {
      return list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    }
    if (sort === 'created') {
      return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }
    if (sort === 'priority') {
      return list.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1));
    }
    return sortTasks(list);
  }, [state.tasks, status, priority, sort, search]);

  const filtersActive = priority !== 'all' || search.trim() !== '' || sort !== 'smart';

  const resetFilters = () => {
    setPriority('all');
    setSearch('');
    setSort('smart');
  };

  const toggle = (task) => {
    if (task.status === 'done') {
      reopenTask(task.id);
      toast('Task reopened.', 'default');
    } else {
      completeTask(task.id);
      toast(`Completed “${task.title}”.`, 'success');
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Workspace"
        title="My Tasks"
        description="Every task here is real. Edit scope, estimates, and deadlines so the plan stays honest instead of aspirational."
        actions={
          <>
            {stats.completed > 0 ? (
              <Button icon="trash" variant="ghost" onClick={() => setConfirmClear(true)}>
                Clear completed
              </Button>
            ) : null}
            <Button variant="primary" icon="plus" onClick={() => setEditor({ open: true, task: null })}>
              New task
            </Button>
          </>
        }
      />

      <div className="stat-strip">
        <div className="stat-cell">
          <span className="stat-label">Open</span>
          <strong className="stat-value">{stats.pending}</strong>
          <span className="stat-note">in the workspace</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">High priority</span>
          <strong className="stat-value">{stats.highOpen}</strong>
          <span className="stat-note">needs attention first</span>
        </div>
        <div className="stat-cell">
          <span className="stat-label">Completed</span>
          <strong className="stat-value">{stats.completed}</strong>
          <span className="stat-note">{stats.completedToday} closed today</span>
        </div>
        <div className={`stat-cell ${stats.overdue > 0 ? 'is-alert' : ''}`}>
          <span className="stat-label">Overdue</span>
          <strong className="stat-value">{stats.overdue}</strong>
          <span className="stat-note">{stats.overdue > 0 ? 'move or finish these' : 'nothing past due'}</span>
        </div>
      </div>

      <section className="card tasks-card" aria-labelledby="tasks-title">
        <div className="tasks-toolbar">
          <div className="segmented" role="tablist" aria-label="Filter by status">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={status === tab.id}
                className={`segment ${status === tab.id ? 'is-active' : ''}`}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
                <span className="segment-count">{counts[tab.id]}</span>
              </button>
            ))}
          </div>

          <div className="tasks-controls">
            <div className="search-field">
              <Icon name="search" size={15} />
              <input
                className="input search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks…"
                aria-label="Search tasks"
                maxLength={120}
              />
            </div>
            <Select className="select-sm" value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority">
              <option value="all">All priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </Select>
            <Select className="select-sm" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort tasks">
              <option value="smart">Smart order</option>
              <option value="due">Deadline first</option>
              <option value="priority">Priority first</option>
              <option value="created">Newest first</option>
            </Select>
          </div>
        </div>

        <div className="tasks-summary">
          <h2 id="tasks-title" className="sr-only">
            Task list
          </h2>
          <span>
            {filtered.length} task{filtered.length === 1 ? '' : 's'}
            {status !== 'all' ? ` · ${status}` : ''}
          </span>
          {filtersActive ? (
            <button type="button" className="text-btn" onClick={resetFilters}>
              Clear filters
            </button>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          counts.all === 0 ? (
            <EmptyState
              icon="tasks"
              title="Your workspace is empty"
              body="Describe what is going on and let the Clarity Engine propose a short plan, or add the first task by hand."
              action={
                <div className="empty-actions">
                  <Button variant="primary" icon="clarity" onClick={() => navigate('clarity')}>
                    Describe the situation
                  </Button>
                  <Button icon="plus" onClick={() => setEditor({ open: true, task: null })}>
                    Add a task
                  </Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="Nothing matches"
              body="Try a different status, priority, or search term. Your tasks are still there."
              action={
                <Button size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <ul className="task-list">
            {filtered.map((task) => {
              const done = task.status === 'done';
              const due = task.dueDate ? formatDueDate(task.dueDate) : null;
              return (
                <li key={task.id} className={`task-row ${done ? 'is-done' : ''}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    className="task-check"
                    onClick={() => toggle(task)}
                    aria-label={done ? `Reopen “${task.title}”` : `Complete “${task.title}”`}
                  >
                    <Icon name="check" size={12} />
                  </button>

                  <div className="task-main">
                    <div className="task-title-row">
                      <button type="button" className="task-title-btn" onClick={() => setEditor({ open: true, task })}>
                        {task.title}
                      </button>
                      <PriorityBadge priority={task.priority} />
                      {due ? <DueBadge due={due} /> : null}
                    </div>

                    {task.description ? <p className="task-desc">{task.description}</p> : null}

                    <div className="task-meta">
                      <span className="meta-item">
                        <Icon name="clock" size={12} /> {formatDuration(task.durationMinutes)}
                      </span>
                      {task.dueDate ? (
                        <span className="meta-item">
                          <Icon name="calendar" size={12} /> {due?.label}
                        </span>
                      ) : null}
                      <span className="meta-item meta-source">
                        {task.source === 'plan' ? 'From plan' : task.source === 'ai' ? 'AI revision' : 'Manual'}
                      </span>
                      {done && task.completedAt ? (
                        <span className="meta-item">Completed {timeAgo(task.completedAt)}</span>
                      ) : null}
                    </div>

                    {task.doneCriteria ? (
                      <p className="task-done-when">
                        <span>Done when</span> {task.doneCriteria}
                      </p>
                    ) : null}
                  </div>

                  <div className="task-actions">
                    {!done ? (
                      <button
                        type="button"
                        className="icon-btn icon-btn-ghost"
                        onClick={() => onStartFocus(task.id)}
                        aria-label={`Start focus on “${task.title}”`}
                        title="Start focus"
                      >
                        <Icon name="play" size={13} />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn icon-btn-ghost"
                      onClick={() => setEditor({ open: true, task })}
                      aria-label={`Edit “${task.title}”`}
                      title="Edit task"
                    >
                      <Icon name="edit" size={15} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-ghost icon-btn-danger"
                      onClick={() => setPendingDelete(task)}
                      aria-label={`Delete “${task.title}”`}
                      title="Delete task"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {filtered.length > 0 ? (
          <button type="button" className="add-row" onClick={() => setEditor({ open: true, task: null })}>
            <Icon name="plus" size={15} />
            Add another task
          </button>
        ) : null}
      </section>

      <TaskEditor open={editor.open} task={editor.task} onClose={() => setEditor({ open: false, task: null })} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this task?"
        message={pendingDelete ? `“${pendingDelete.title}” will be removed from this browser. This cannot be undone.` : ''}
        confirmLabel="Delete task"
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteTask(pendingDelete.id);
            toast('Task deleted.', 'default');
          }
        }}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear completed tasks?"
        message={`${stats.completed} completed task${stats.completed === 1 ? '' : 's'} will be removed. Focus sessions and reflections stay in your history.`}
        confirmLabel="Clear completed"
        onClose={() => setConfirmClear(false)}
        onConfirm={() => {
          clearCompleted();
          toast('Completed tasks cleared.', 'success');
        }}
      />
    </div>
  );
}
