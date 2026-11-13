import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  defaultState,
  hydrateState,
  loadState,
  makeActivity,
  makeTask,
  saveState,
  STORAGE_KEY,
} from '../lib/storage.js';
import { makeId, todayISO } from '../lib/fmt.js';
import { computeStats } from '../lib/stats.js';
import { getHealth } from '../lib/api.js';

const AppContext = createContext(null);

export function timerElapsed(timer) {
  if (!timer) return 0;
  const runningExtra = timer.runningSince ? (Date.now() - timer.runningSince) / 1000 : 0;
  return Math.max(0, (timer.elapsedSeconds || 0) + runningExtra);
}

export function AppProvider({ children }) {
  const [state, setState] = useState(loadState);
  const [toasts, setToasts] = useState([]);
  const [health, setHealth] = useState({ status: 'loading', mode: 'unknown', model: '', hasApiKey: false });
  const [timer, setTimer] = useState(null);
  const timersRef = useRef(new Set());

  /* persist ------------------------------------------------------------- */
  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = state.profile.theme === 'light' ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', state.profile.theme === 'light' ? '#F5F5EF' : '#0A0B09');
  }, [state.profile.theme]);

  /* health -------------------------------------------------------------- */
  const refreshHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth({
        status: 'ready',
        mode: data.mode,
        model: data.model,
        hasApiKey: Boolean(data.hasApiKey),
        version: data.version,
        checkedAt: new Date().toISOString(),
      });
      return data;
    } catch {
      setHealth({ status: 'offline', mode: 'offline', model: '', hasApiKey: false });
      return null;
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  /* toasts -------------------------------------------------------------- */
  const toast = useCallback((message, tone = 'default') => {
    const id = makeId('toast');
    setToasts((current) => [...current, { id, message, tone }]);
    const handle = setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
      timersRef.current.delete(handle);
    }, 4500);
    timersRef.current.add(handle);
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  useEffect(
    () => () => {
      for (const handle of timersRef.current) clearTimeout(handle);
    },
    [],
  );

  /* activity helper ----------------------------------------------------- */
  const withActivity = useCallback((nextState, entries) => {
    const list = Array.isArray(entries) ? entries : [entries];
    const valid = list.filter(Boolean);
    if (valid.length === 0) return nextState;
    return {
      ...nextState,
      activities: [...valid, ...nextState.activities].slice(0, 120),
    };
  }, []);

  /* task actions -------------------------------------------------------- */
  const addTask = useCallback(
    (input) => {
      const task = makeTask(input);
      if (!task.title) return null;
      setState((current) =>
        withActivity(
          { ...current, tasks: [task, ...current.tasks].slice(0, 500) },
          makeActivity('task_created', `Added “${task.title}”`),
        ),
      );
      return task;
    },
    [withActivity],
  );

  const addTasks = useCallback(
    (inputs, { source = 'ai' } = {}) => {
      const existing = new Set();
      setState((current) => {
        current.tasks.forEach((t) => existing.add(t.title.trim().toLowerCase()));
        const fresh = [];
        for (const input of inputs || []) {
          const task = makeTask({ ...input, source });
          if (!task.title) continue;
          const key = task.title.trim().toLowerCase();
          if (existing.has(key)) continue;
          existing.add(key);
          fresh.push(task);
        }
        if (fresh.length === 0) return current;
        return withActivity(
          { ...current, tasks: [...fresh, ...current.tasks].slice(0, 500) },
          makeActivity(
            'plan_applied',
            fresh.length === 1 ? `Added “${fresh[0].title}” from a plan` : `Added ${fresh.length} tasks from a plan`,
          ),
        );
      });
      return true;
    },
    [withActivity],
  );

  const updateTask = useCallback(
    (id, patch, { silent = false } = {}) => {
      setState((current) => {
        const target = current.tasks.find((t) => t.id === id);
        if (!target) return current;
        const updated = { ...target, ...patch, id: target.id };
        const next = { ...current, tasks: current.tasks.map((t) => (t.id === id ? updated : t)) };
        if (silent) return next;
        return withActivity(next, makeActivity('task_updated', `Updated “${updated.title}”`));
      });
    },
    [withActivity],
  );

  const completeTask = useCallback(
    (id, { silent = false } = {}) => {
      setState((current) => {
        const target = current.tasks.find((t) => t.id === id);
        if (!target || target.status === 'done') return current;
        const next = {
          ...current,
          tasks: current.tasks.map((t) =>
            t.id === id ? { ...t, status: 'done', completedAt: new Date().toISOString() } : t,
          ),
        };
        if (silent) return next;
        return withActivity(next, makeActivity('task_completed', `Completed “${target.title}”`));
      });
    },
    [withActivity],
  );

  const reopenTask = useCallback(
    (id) => {
      setState((current) => {
        const target = current.tasks.find((t) => t.id === id);
        if (!target || target.status !== 'done') return current;
        return withActivity(
          {
            ...current,
            tasks: current.tasks.map((t) => (t.id === id ? { ...t, status: 'open', completedAt: null } : t)),
          },
          makeActivity('task_updated', `Reopened “${target.title}”`),
        );
      });
    },
    [withActivity],
  );

  const deleteTask = useCallback(
    (id) => {
      setState((current) => {
        const target = current.tasks.find((t) => t.id === id);
        if (!target) return current;
        return withActivity(
          { ...current, tasks: current.tasks.filter((t) => t.id !== id) },
          makeActivity('task_deleted', `Deleted “${target.title}”`),
        );
      });
    },
    [withActivity],
  );

  const clearCompleted = useCallback(() => {
    setState((current) => {
      const count = current.tasks.filter((t) => t.status === 'done').length;
      if (!count) return current;
      return withActivity(
        { ...current, tasks: current.tasks.filter((t) => t.status !== 'done') },
        makeActivity('task_deleted', `Cleared ${count} completed task${count === 1 ? '' : 's'}`),
      );
    });
  }, [withActivity]);

  /* focus --------------------------------------------------------------- */
  const logSession = useCallback(
    ({ taskId, taskTitle, minutes, plannedMinutes, completed }) => {
      const rounded = Math.round(Number(minutes) || 0);
      if (rounded < 1) return null;
      const session = {
        id: makeId('session'),
        taskId: taskId || null,
        taskTitle: taskTitle || 'Focus session',
        minutes: Math.min(600, rounded),
        plannedMinutes: Math.max(rounded, Math.round(Number(plannedMinutes) || rounded)),
        date: todayISO(),
        startedAt: new Date(Date.now() - rounded * 60_000).toISOString(),
        endedAt: new Date().toISOString(),
        completed: Boolean(completed),
      };
      setState((current) =>
        withActivity(
          { ...current, sessions: [session, ...current.sessions].slice(0, 500) },
          makeActivity(
            'focus',
            `Logged ${rounded} min of focus${taskTitle ? ` on “${taskTitle}”` : ''}`,
          ),
        ),
      );
      return session;
    },
    [withActivity],
  );

  const startTimer = useCallback(({ taskId, taskTitle, minutes }) => {
    const planned = Math.min(180, Math.max(5, Math.round(Number(minutes) || 25)));
    setTimer({
      taskId: taskId || null,
      taskTitle: taskTitle || '',
      plannedMinutes: planned,
      elapsedSeconds: 0,
      runningSince: Date.now(),
      startedAt: Date.now(),
    });
  }, []);

  const pauseTimer = useCallback(() => {
    setTimer((current) => {
      if (!current || !current.runningSince) return current;
      const extra = (Date.now() - current.runningSince) / 1000;
      return { ...current, elapsedSeconds: (current.elapsedSeconds || 0) + extra, runningSince: null };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer((current) => (current && !current.runningSince ? { ...current, runningSince: Date.now() } : current));
  }, []);

  const resetTimer = useCallback(() => setTimer(null), []);

  const extendTimer = useCallback((minutes) => {
    setTimer((current) =>
      current ? { ...current, plannedMinutes: Math.min(240, current.plannedMinutes + Number(minutes || 0)) } : current,
    );
  }, []);

  /* conversation -------------------------------------------------------- */
  const appendMessage = useCallback((message) => {
    setState((current) => ({ ...current, conversation: [...current.conversation, message].slice(-40) }));
  }, []);

  const clearConversation = useCallback(() => {
    setState((current) => ({ ...current, conversation: [] }));
  }, []);

  const markMessageError = useCallback((id, errorMessage) => {
    setState((current) => ({
      ...current,
      conversation: current.conversation.map((m) => (m.id === id ? { ...m, error: errorMessage } : m)),
    }));
  }, []);

  /* reflections --------------------------------------------------------- */
  const addReflection = useCallback(({ input, result, mode }) => {
    const entry = {
      id: makeId('refl'),
      createdAt: new Date().toISOString(),
      mode: mode === 'live' ? 'live' : 'demo',
      input,
      result,
    };
    setState((current) =>
      withActivity(
        { ...current, reflections: [entry, ...current.reflections].slice(0, 50) },
        makeActivity('reflection', `Wrote a reflection: “${String(result?.headline || '').slice(0, 80)}”`),
      ),
    );
    return entry;
  }, [withActivity]);

  const deleteReflection = useCallback((id) => {
    setState((current) => ({ ...current, reflections: current.reflections.filter((r) => r.id !== id) }));
  }, []);

  /* profile & data ------------------------------------------------------ */
  const updateProfile = useCallback((patch) => {
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        ...patch,
        name: typeof patch.name === 'string' ? patch.name.trim().slice(0, 60) : current.profile.name,
      },
    }));
  }, []);

  const clearWorkspace = useCallback(() => {
    setState((current) => ({
      ...current,
      tasks: [],
      sessions: [],
      activities: [],
      reflections: [],
      conversation: [],
    }));
  }, []);

  const clearEverything = useCallback(() => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
    const fresh = defaultState();
    fresh.profile.theme = state.profile.theme;
    setState(fresh);
  }, [state.profile.theme]);

  const importData = useCallback((raw) => {
    const next = hydrateState(raw);
    setState(next);
    return next;
  }, []);

  const stats = useMemo(() => computeStats(state), [state]);

  const value = useMemo(
    () => ({
      state,
      stats,
      health,
      refreshHealth,
      toast,
      toasts,
      dismissToast,
      addTask,
      addTasks,
      updateTask,
      completeTask,
      reopenTask,
      deleteTask,
      clearCompleted,
      logSession,
      timer,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      extendTimer,
      appendMessage,
      clearConversation,
      markMessageError,
      addReflection,
      deleteReflection,
      updateProfile,
      clearWorkspace,
      clearEverything,
      importData,
    }),
    [
      state,
      stats,
      health,
      refreshHealth,
      toast,
      toasts,
      dismissToast,
      addTask,
      addTasks,
      updateTask,
      completeTask,
      reopenTask,
      deleteTask,
      clearCompleted,
      logSession,
      timer,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      extendTimer,
      appendMessage,
      clearConversation,
      markMessageError,
      addReflection,
      deleteReflection,
      updateProfile,
      clearWorkspace,
      clearEverything,
      importData,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
