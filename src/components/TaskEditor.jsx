import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { Button, Field, Input, Modal, Select, Textarea } from './ui.jsx';
import { todayISO } from '../lib/fmt.js';

const PRIORITIES = ['High', 'Medium', 'Low'];

const emptyForm = () => ({
  title: '',
  description: '',
  priority: 'Medium',
  durationMinutes: 25,
  dueDate: '',
  doneCriteria: '',
});

export function TaskEditor({ open, task, onClose }) {
  const { addTask, updateTask, toast } = useApp();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      task
        ? {
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            durationMinutes: task.durationMinutes,
            dueDate: task.dueDate || '',
            doneCriteria: task.doneCriteria || '',
          }
        : emptyForm(),
    );
  }, [open, task]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    const nextErrors = {};
    const title = form.title.trim();
    if (title.length < 3) nextErrors.title = 'Give the task a title of at least three characters.';
    const minutes = Number(form.durationMinutes);
    if (!Number.isFinite(minutes) || minutes < 5 || minutes > 240) {
      nextErrors.durationMinutes = 'Estimate between 5 and 240 minutes.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload = {
      title,
      description: form.description.trim(),
      priority: form.priority,
      durationMinutes: Math.round(minutes),
      dueDate: form.dueDate,
      doneCriteria: form.doneCriteria.trim(),
    };

    if (task) {
      updateTask(task.id, payload);
      toast('Task updated.', 'success');
    } else {
      addTask({ ...payload, source: 'manual' });
      toast('Task created.', 'success');
    }
    onClose?.();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      description={
        task
          ? 'Changes save straight to this browser’s local workspace.'
          : 'Keep it small enough to finish in one sitting. A clear “done when” makes the task usable.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={task ? 'check' : 'plus'} type="submit" form="task-editor-form">
            {task ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form className="form-stack" id="task-editor-form" onSubmit={submit}>
        <Field label="Task title" htmlFor="task-title" error={errors.title}>
          <Input
            id="task-title"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="Finish the smallest useful version of…"
            maxLength={160}
            autoFocus
          />
        </Field>

        <Field label="How to do it" htmlFor="task-description" optional hint="One or two sentences. What does starting look like?">
          <Textarea
            id="task-description"
            rows={3}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            maxLength={800}
            placeholder="Open the brief, draft the first section, then stop."
          />
        </Field>

        <div className="form-grid">
          <Field label="Priority" htmlFor="task-priority">
            <Select id="task-priority" value={form.priority} onChange={(event) => set('priority', event.target.value)}>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Estimate (minutes)" htmlFor="task-duration" error={errors.durationMinutes}>
            <Input
              id="task-duration"
              type="number"
              min="5"
              max="240"
              step="5"
              value={form.durationMinutes}
              onChange={(event) => set('durationMinutes', event.target.value)}
            />
          </Field>
          <Field label="Deadline" htmlFor="task-due" optional>
            <Input id="task-due" type="date" value={form.dueDate} min={todayISO()} onChange={(event) => set('dueDate', event.target.value)} />
          </Field>
        </div>

        <Field
          label="Done when"
          htmlFor="task-done"
          optional
          hint="Observable evidence: a file submitted, a message sent, a payment confirmed."
        >
          <Textarea
            id="task-done"
            rows={2}
            value={form.doneCriteria}
            onChange={(event) => set('doneCriteria', event.target.value)}
            maxLength={400}
            placeholder="The draft is submitted and the confirmation is saved."
          />
        </Field>
      </form>
    </Modal>
  );
}
