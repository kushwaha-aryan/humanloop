import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { requestClarity } from '../lib/api.js';
import { formatShortDate, todayISO } from '../lib/fmt.js';
import { Badge, Button, ConfirmDialog, Field, Input, PageHeader, Select } from '../components/ui.jsx';
import { Icon } from '../components/Icons.jsx';

export default function Settings({ navigate }) {
  const {
    state,
    stats,
    health,
    refreshHealth,
    updateProfile,
    clearWorkspace,
    clearEverything,
    importData,
    toast,
  } = useApp();

  const [nameDraft, setNameDraft] = useState(state.profile.name);
  const [test, setTest] = useState({ status: 'idle' });
  const [confirmWorkspace, setConfirmWorkspace] = useState(false);
  const [confirmEverything, setConfirmEverything] = useState(false);
  const fileRef = useRef(null);

  const isLive = health.mode === 'live';
  const counts = {
    tasks: state.tasks.length,
    sessions: state.sessions.length,
    reflections: state.reflections.length,
    messages: state.conversation.length,
  };

  const saveName = () => {
    if (nameDraft.trim() === state.profile.name) return;
    updateProfile({ name: nameDraft });
    toast('Name saved.', 'success');
  };

  const changeNumber = (key, value, min, max, fallback) => {
    const n = Number(value);
    const next = Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    updateProfile({ [key]: next });
  };

  const runConnectionTest = async () => {
    setTest({ status: 'loading' });
    try {
      const data = await requestClarity({
        situation: 'I have one overdue bill, a report due tomorrow, and about two hours before work. I keep avoiding the bill.',
        tasks: [],
      });
      setTest({
        status: 'ok',
        mode: data.mode,
        model: data.model,
        latency: data.latencyMs,
        headline: data.result.headline,
        tasks: data.result.tasks.length,
      });
      refreshHealth();
    } catch (error) {
      setTest({ status: 'error', message: error.message || 'The test request failed.' });
    }
  };

  const exportData = () => {
    const payload = { ...state, exportedAt: new Date().toISOString(), app: 'HumanLoop', schemaVersion: state.schemaVersion };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `humanloop-backup-${todayISO()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    toast('Backup downloaded.', 'success');
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) {
      toast('That file is too large to be a HumanLoop backup.', 'error');
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || (!Array.isArray(parsed.tasks) && !Array.isArray(parsed.sessions))) {
        throw new Error('This does not look like a HumanLoop backup.');
      }
      const next = importData(parsed);
      setNameDraft(next.profile.name);
      toast(`Imported ${next.tasks.length} tasks and ${next.sessions.length} sessions.`, 'success');
    } catch (error) {
      toast(error.message || 'Could not read that backup file.', 'error');
    }
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Preferences"
        title="Settings"
        description="Everything is stored locally in this browser. There is no account, and the Groq key never leaves the server."
        actions={
          <Badge tone={isLive ? 'accent' : 'neutral'} dot>
            {isLive ? 'Live AI connected' : health.status === 'offline' ? 'Server offline' : 'Demo mode'}
          </Badge>
        }
      />

      <div className="grid-settings">
        <div className="settings-main">
          <section className="card" aria-labelledby="profile-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Identity</p>
                <h2 id="profile-title" className="card-title">
                  Your workspace
                </h2>
              </div>
            </div>
            <div className="form-grid form-grid-name">
              <Field label="What should HumanLoop call you?" htmlFor="settings-name" hint="Only used in the dashboard greeting. Stored in this browser.">
                <div className="inline-save">
                  <Input
                    id="settings-name"
                    value={nameDraft}
                    onChange={(event) => setNameDraft(event.target.value)}
                    onBlur={saveName}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                    }}
                    maxLength={60}
                    placeholder="Your first name"
                  />
                  <Button size="sm" variant="secondary" onClick={saveName} disabled={nameDraft.trim() === state.profile.name}>
                    Save
                  </Button>
                </div>
              </Field>
            </div>

            <div className="settings-row">
              <div>
                <h3>Default focus length</h3>
                <p>Used as the starting timer length in Focus Mode.</p>
              </div>
              <Select
                className="select-sm select-fixed"
                value={state.profile.focusMinutes}
                onChange={(event) => changeNumber('focusMinutes', event.target.value, 5, 120, 25)}
                aria-label="Default focus length"
              >
                {[15, 20, 25, 30, 45, 50, 60, 90].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </Select>
            </div>

            <div className="settings-row">
              <div>
                <h3>Daily focus capacity</h3>
                <p>Shown against logged focus time. Set it to what a normal day can hold, not a perfect one.</p>
              </div>
              <Select
                className="select-sm select-fixed"
                value={state.profile.dailyCapacityMinutes}
                onChange={(event) => changeNumber('dailyCapacityMinutes', event.target.value, 30, 720, 180)}
                aria-label="Daily focus capacity"
              >
                {[60, 90, 120, 180, 240, 300, 360, 480].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </Select>
            </div>
          </section>

          <section className="card" aria-labelledby="appearance-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Appearance</p>
                <h2 id="appearance-title" className="card-title">
                  Theme
                </h2>
              </div>
            </div>
            <div className="theme-options" role="radiogroup" aria-label="Theme">
              {[
                { id: 'dark', label: 'Charcoal', detail: 'Dark-first, easier at night', icon: 'moon' },
                { id: 'light', label: 'Paper', detail: 'Warm light for daylight work', icon: 'sun' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={state.profile.theme === option.id}
                  className={`theme-option ${state.profile.theme === option.id ? 'is-active' : ''}`}
                  onClick={() => updateProfile({ theme: option.id })}
                >
                  <span className={`theme-swatch theme-swatch-${option.id}`} aria-hidden="true">
                    <Icon name={option.icon} size={16} />
                  </span>
                  <span>
                    <strong>{option.label}</strong>
                    <small>{option.detail}</small>
                  </span>
                  <span className="theme-check" aria-hidden="true">
                    {state.profile.theme === option.id ? <Icon name="check" size={14} /> : null}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="card ai-card" aria-labelledby="ai-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Model access</p>
                <h2 id="ai-title" className="card-title">
                  AI connection
                </h2>
              </div>
              <Badge tone={isLive ? 'accent' : 'neutral'} dot>
                {isLive ? 'Live' : 'Demo'}
              </Badge>
            </div>

            <dl className="ai-facts">
              <div>
                <dt>Mode</dt>
                <dd>{isLive ? 'Live Groq API' : 'Demo mode — local sample responses'}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>
                  <code>{health.model || 'openai/gpt-oss-120b'}</code>
                </dd>
              </div>
              <div>
                <dt>API key</dt>
                <dd>{health.hasApiKey ? 'Configured on the server' : 'Not configured'}</dd>
              </div>
              <div>
                <dt>Server</dt>
                <dd>
                  {health.status === 'ready'
                    ? `Responding · v${health.version || '1.0.0'}`
                    : health.status === 'loading'
                      ? 'Checking…'
                      : 'Unreachable'}
                </dd>
              </div>
              <div>
                <dt>Last checked</dt>
                <dd>{health.checkedAt ? formatShortDate(health.checkedAt) : '—'}</dd>
              </div>
            </dl>

            {!isLive ? (
              <div className="setup-note">
                <h3>Enable live AI in three steps</h3>
                <ol>
                  <li>
                    Create a key at{' '}
                    <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer">
                      console.groq.com/keys
                    </a>
                    .
                  </li>
                  <li>
                    Copy <code>.env.example</code> to <code>.env</code> and set <code>GROQ_API_KEY</code>. Never commit it.
                  </li>
                  <li>Restart the server. This badge turns lime when it is live.</li>
                </ol>
              </div>
            ) : null}

            <div className="ai-actions">
              <Button icon="bolt" variant="secondary" onClick={runConnectionTest} loading={test.status === 'loading'} disabled={test.status === 'loading'}>
                {test.status === 'loading' ? 'Testing' : 'Test AI connection'}
              </Button>
              <Button icon="rotate" variant="ghost" onClick={refreshHealth}>
                Refresh status
              </Button>
            </div>

            {test.status === 'ok' ? (
              <div className="test-result test-ok" role="status">
                <Icon name="check" size={15} />
                <div>
                  <strong>
                    {test.mode === 'live' ? `Live response received in ${test.latency}ms` : 'Demo sample generated'}
                  </strong>
                  <p>
                    {test.tasks} tasks · “{test.headline}”.{' '}
                    {test.mode === 'demo' ? 'No key configured, so no model was called.' : `Model: ${test.model}.`}
                  </p>
                </div>
              </div>
            ) : null}
            {test.status === 'error' ? (
              <div className="test-result test-error" role="alert">
                <Icon name="alert" size={15} />
                <div>
                  <strong>Connection test failed</strong>
                  <p>{test.message}</p>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="settings-side">
          <section className="card" aria-labelledby="data-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Portability</p>
                <h2 id="data-title" className="card-title">
                  Your data
                </h2>
              </div>
            </div>
            <ul className="data-counts">
              <li>
                <span>Tasks</span>
                <strong>{counts.tasks}</strong>
              </li>
              <li>
                <span>Focus sessions</span>
                <strong>{counts.sessions}</strong>
              </li>
              <li>
                <span>Reflections</span>
                <strong>{counts.reflections}</strong>
              </li>
              <li>
                <span>Conversation messages</span>
                <strong>{counts.messages}</strong>
              </li>
            </ul>
            <p className="context-note">
              Stored in this browser only. A backup is a JSON file you control — no account, no server copy. {stats.focusMinutesToday > 0 ? `Today you have ${stats.focusMinutesToday} focused minutes logged.` : 'No focus time is logged today yet.'}
            </p>
            <div className="data-actions">
              <Button icon="download" onClick={exportData}>
                Export backup
              </Button>
              <Button icon="upload" onClick={() => fileRef.current?.click()}>
                Import backup
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={importFile} tabIndex={-1} />
            </div>
            <p className="field-hint">Importing replaces the current tasks, history, and conversation with the file’s contents.</p>
          </section>

          <section className="card danger-card" aria-labelledby="reset-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">Irreversible</p>
                <h2 id="reset-title" className="card-title">
                  Reset
                </h2>
              </div>
            </div>
            <div className="danger-row">
              <div>
                <h3>Clear workspace</h3>
                <p>Removes tasks, sessions, activity, reflections, and the clarity thread. Keeps your name and preferences.</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setConfirmWorkspace(true)}>
                Clear workspace
              </Button>
            </div>
            <div className="danger-row">
              <div>
                <h3>Erase everything</h3>
                <p>Deletes all local HumanLoop data and resets preferences. Your theme is kept so the screen does not flash.</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setConfirmEverything(true)}>
                Erase everything
              </Button>
            </div>
          </section>

          <section className="card about-card">
            <p className="eyebrow">About</p>
            <h2 className="card-title">HumanLoop 1.0.0</h2>
            <p className="context-note">
              Built for the Engage Test hackathon. React + Vite frontend, Express backend, Groq’s OpenAI-compatible API, and
              browser-local persistence. No analytics, no tracking, no accounts.
            </p>
            <div className="about-links">
              <Button size="sm" variant="ghost" icon="arrowUpRight" onClick={() => window.open('https://console.groq.com/docs', '_blank', 'noopener')}>
                Groq docs
              </Button>
              <Button size="sm" variant="ghost" icon="reflection" onClick={() => navigate('reflection')}>
                Reflect on today
              </Button>
            </div>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmWorkspace}
        title="Clear the workspace?"
        message="Tasks, focus sessions, activity, reflections, and the clarity conversation will be removed from this browser. Preferences stay."
        confirmLabel="Clear workspace"
        onClose={() => setConfirmWorkspace(false)}
        onConfirm={() => {
          clearWorkspace();
          toast('Workspace cleared.', 'default');
        }}
      />

      <ConfirmDialog
        open={confirmEverything}
        title="Erase all local data?"
        message="This removes every task, session, reflection, and preference stored by HumanLoop in this browser. There is no server copy to restore."
        confirmLabel="Erase everything"
        onClose={() => setConfirmEverything(false)}
        onConfirm={() => {
          clearEverything();
          setNameDraft('');
          toast('All local HumanLoop data erased.', 'default');
        }}
      />
    </div>
  );
}
