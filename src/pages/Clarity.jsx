import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { requestClarity } from '../lib/api.js';
import { makeId, timeAgo } from '../lib/fmt.js';
import { Badge, Button, ConfirmDialog, InlineError, PageHeader, Skeleton, Textarea } from '../components/ui.jsx';
import { PlanReview } from '../components/PlanReview.jsx';
import { Icon } from '../components/Icons.jsx';
import { PROMPT_SUGGESTIONS } from '../lib/storage.js';

export default function Clarity({ navigate, draft, setDraft, health }) {
  const { state, stats, appendMessage, clearConversation, toast } = useApp();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const bottomRef = useRef(null);
  const autoSent = useRef(false);
  const textareaRef = useRef(null);

  const send = useCallback(
    async (rawText, { appendUser = true } = {}) => {
      const text = String(rawText || '').trim();
      if (text.length < 8) {
        toast('Add a little more detail — one honest sentence is enough to build a plan.', 'error');
        return;
      }
      if (loading) return;
      setError(null);
      setLoading(true);

      if (appendUser) {
        appendMessage({ id: makeId('msg'), role: 'user', content: text, at: new Date().toISOString() });
      }

      const history = state.conversation.slice(-8).map((message) => ({
        role: message.role,
        content: message.plan
          ? `${message.plan.headline}. ${message.plan.understanding}`.slice(0, 900)
          : String(message.content || '').slice(0, 900),
      }));

      try {
        const data = await requestClarity({ situation: text, tasks: state.tasks, history });
        appendMessage({
          id: makeId('msg'),
          role: 'assistant',
          content: data.result.headline,
          mode: data.mode,
          plan: data.result,
          at: new Date().toISOString(),
        });
        setInput('');
        if (data.mode === 'demo') {
          toast('Demo sample ready. Add GROQ_API_KEY for live AI.', 'default');
        }
      } catch (requestError) {
        setError({ message: requestError.message || 'The plan request failed.', text });
      } finally {
        setLoading(false);
      }
    },
    [appendMessage, loading, state.conversation, state.tasks, toast],
  );

  useEffect(() => {
    const seed = String(draft || '').trim();
    if (!seed || autoSent.current) return;
    autoSent.current = true;
    setInput(seed);
    setDraft('');
    send(seed);
  }, [draft, send, setDraft]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state.conversation.length, loading]);

  const submit = (event) => {
    event?.preventDefault?.();
    send(input);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!loading && input.trim().length >= 8) send(input);
    }
  };

  const resetThread = () => {
    clearConversation();
    setError(null);
    setInput('');
    autoSent.current = true;
    toast('Started a new clarity thread. The old one is cleared from this browser.', 'default');
  };

  return (
    <div className="stack">
      <PageHeader
        eyebrow="AI Clarity Engine"
        title="Start with the honest version."
        description="Describe what is actually going on. You get a short, specific plan with estimates and deadlines — not a pep talk."
        actions={
          <>
            {health.mode === 'demo' ? <Badge tone="neutral">Demo mode</Badge> : <Badge tone="accent" dot>Live AI</Badge>}
            <Button
              icon="plus"
              variant="ghost"
              onClick={() => (state.conversation.length > 0 ? setConfirmNew(true) : resetThread())}
            >
              New thread
            </Button>
          </>
        }
      />

      <div className="grid-clarity">
        <section className="card thread-card" aria-label="Clarity conversation">
          <div className="thread" aria-live="polite">
            {state.conversation.length === 0 && !loading ? (
              <div className="clarity-welcome">
                <span className="clarity-mark" aria-hidden="true">
                  <Icon name="brain" size={22} />
                </span>
                <p className="eyebrow">Clarity, not cheerleading</p>
                <h2>Tell it where the tangle is.</h2>
                <p className="clarity-lede">
                  Include the deadlines, the half-finished things, and the task you keep avoiding. HumanLoop will separate what is urgent
                  from what is merely loud, then propose a plan small enough to start today.
                </p>
                <ul className="clarity-principles">
                  <li>3–5 concrete tasks with real time estimates</li>
                  <li>Blockers named, not buried under motivation</li>
                  <li>Nothing added to your workspace without your say</li>
                </ul>
                <div className="prompt-chips">
                  <span className="prompt-chips-label">Try a real example</span>
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="prompt-chip"
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                    >
                      <span>{suggestion}</span>
                      <Icon name="arrowRight" size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {state.conversation.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="msg msg-user">
                  <div className="msg-bubble">{message.content}</div>
                  <time className="msg-time">{timeAgo(message.at)}</time>
                </div>
              ) : (
                <div key={message.id} className="msg msg-assistant">
                  <div className="msg-head">
                    <span className="ai-mark" aria-hidden="true">
                      <Icon name="brain" size={14} />
                    </span>
                    <span className="msg-author">HumanLoop</span>
                    <Badge tone={message.mode === 'live' ? 'accent' : 'neutral'}>
                      {message.mode === 'live' ? 'Live AI' : 'Demo sample'}
                    </Badge>
                    <time className="msg-time">{timeAgo(message.at)}</time>
                  </div>
                  {message.plan ? (
                    <PlanReview plan={message.plan} onNavigate={navigate} />
                  ) : (
                    <p className="msg-text">{message.content}</p>
                  )}
                </div>
              ),
            )}

            {loading ? (
              <div className="msg msg-assistant msg-loading" role="status">
                <div className="msg-head">
                  <span className="ai-mark" aria-hidden="true">
                    <Icon name="spinner" size={14} className="spin" />
                  </span>
                  <span className="msg-author">Clarity Engine</span>
                </div>
                <p className="ai-loading-note">Reading the situation, separating urgency from noise, sizing the work.</p>
                <Skeleton lines={3} />
              </div>
            ) : null}

            {error ? (
              <InlineError
                message={error.message}
                onRetry={() => send(error.text, { appendUser: false })}
                retryLabel="Send it again"
              />
            ) : null}

            <div ref={bottomRef} />
          </div>

          <form className="composer" onSubmit={submit}>
            <label className="sr-only" htmlFor="clarity-input">
              Describe your situation
            </label>
            <Textarea
              id="clarity-input"
              ref={textareaRef}
              rows={3}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder="What is going on? Deadlines, people waiting on you, the thing you keep opening and closing…"
              maxLength={4000}
              disabled={loading}
            />
            <div className="composer-foot">
              <div className="composer-hint">
                <span>Enter to send · Shift + Enter for a new line</span>
                <span className="composer-count">{input.length}/4000</span>
              </div>
              <Button
                type="submit"
                variant="primary"
                icon="clarity"
                loading={loading}
                disabled={loading || input.trim().length < 8}
              >
                {loading ? 'Building the plan' : 'Find my next step'}
              </Button>
            </div>
            <p className="composer-note">
              {health.mode === 'live'
                ? `Live AI via Groq (${health.model}). Your description and a compact summary of open tasks are sent to the server; the API key never reaches the browser.`
                : health.mode === 'demo'
                  ? 'Demo mode: plans are realistic local samples generated from your words, not live model output. Set GROQ_API_KEY to enable real AI.'
                  : 'The HumanLoop server is not reachable. Start it with `npm run dev` or `npm start`, then try again.'}
            </p>
          </form>
        </section>

        <aside className="clarity-side">
          <section className="card context-card" aria-labelledby="context-title">
            <div className="card-head">
              <div>
                <p className="eyebrow">In the room</p>
                <h2 id="context-title" className="card-title">
                  Working context
                </h2>
              </div>
            </div>
            <dl className="context-list">
              <div>
                <dt>Open tasks</dt>
                <dd>{stats.pending}</dd>
              </div>
              <div>
                <dt>High priority</dt>
                <dd>{stats.highOpen}</dd>
              </div>
              <div>
                <dt>Overdue</dt>
                <dd className={stats.overdue > 0 ? 'is-alert' : ''}>{stats.overdue}</dd>
              </div>
              <div>
                <dt>Focus today</dt>
                <dd>{stats.focusMinutesToday}m</dd>
              </div>
            </dl>
            <p className="context-note">
              HumanLoop sends a compact summary of these tasks with your message so plans do not duplicate work you already have.
            </p>
            <div className="context-actions">
              <Button size="sm" icon="tasks" onClick={() => navigate('tasks')}>
                Review tasks
              </Button>
              <Button size="sm" variant="ghost" icon="focus" onClick={() => navigate('focus')}>
                Focus
              </Button>
            </div>
          </section>

          <section className="card explainer-card">
            <p className="eyebrow">How it works</p>
            <ol className="explainer-list">
              <li>
                <span>01</span>
                <div>
                  <strong>It reads the whole tangle</strong>
                  <p>Everything you write is considered together, including what you imply but do not say.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>It cuts to a realistic plan</strong>
                  <p>Tasks get sizes and deadlines that fit a day, not a fantasy schedule.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>You stay in control</strong>
                  <p>Every task is editable, and the plan only enters your workspace when you add it.</p>
                </div>
              </li>
            </ol>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmNew}
        title="Start a new thread?"
        message="The current conversation will be cleared from this browser. Tasks you already added stay in your workspace."
        confirmLabel="Start new thread"
        tone="primary"
        onClose={() => setConfirmNew(false)}
        onConfirm={resetThread}
      />
    </div>
  );
}
