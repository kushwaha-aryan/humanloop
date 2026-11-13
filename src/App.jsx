import { useCallback, useEffect, useState } from 'react';
import { useApp } from './context/AppContext.jsx';
import { Sidebar, NAV_ITEMS } from './components/Sidebar.jsx';
import { BrandLockup } from './components/Brand.jsx';
import { Icon } from './components/Icons.jsx';
import { Toasts } from './components/ui.jsx';
import Overview from './pages/Overview.jsx';
import Clarity from './pages/Clarity.jsx';
import Tasks from './pages/Tasks.jsx';
import Focus from './pages/Focus.jsx';
import Reflection from './pages/Reflection.jsx';
import Settings from './pages/Settings.jsx';

const ROUTES = NAV_ITEMS.map((item) => item.id);

function readRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.includes(raw) ? raw : 'overview';
}

export default function App() {
  const { state, stats, health, timer, toasts, dismissToast } = useApp();
  const [route, setRoute] = useState(readRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const [clarityDraft, setClarityDraft] = useState('');
  const [focusTaskId, setFocusTaskId] = useState(null);

  useEffect(() => {
    const onHashChange = () => setRoute(readRoute());
    window.addEventListener('hashchange', onHashChange);
    if (!window.location.hash) window.history.replaceState(null, '', '#/overview');
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setMenuOpen(false);
  }, [route]);

  const navigate = useCallback((next) => {
    if (!ROUTES.includes(next)) return;
    if (readRoute() === next) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setMenuOpen(false);
      return;
    }
    window.location.hash = `#/${next}`;
  }, []);

  const goToClarity = useCallback(
    (text = '') => {
      setClarityDraft(text);
      navigate('clarity');
    },
    [navigate],
  );

  const goToFocus = useCallback(
    (taskId = null) => {
      if (taskId) setFocusTaskId(taskId);
      navigate('focus');
    },
    [navigate],
  );

  const shared = { navigate, onNavigate: navigate, onQuickPlan: goToClarity, onStartFocus: goToFocus, health };

  return (
    <div className="app-shell">
      <Sidebar
        route={route}
        onNavigate={navigate}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        stats={stats}
        health={health}
        profile={state.profile}
        timer={timer}
      />

      <div className="app-main">
        <header className="mobile-bar">
          <button type="button" className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Icon name="menu" size={20} />
          </button>
          <BrandLockup compact onClick={() => navigate('overview')} />
          <button type="button" className="icon-btn" onClick={() => navigate('settings')} aria-label="Open settings">
            <Icon name="settings" size={18} />
          </button>
        </header>

        <main className="page-wrap" id="main-content">
          <div className="page" key={route}>
            {route === 'overview' ? (
              <Overview {...shared} />
            ) : route === 'clarity' ? (
              <Clarity {...shared} draft={clarityDraft} setDraft={setClarityDraft} />
            ) : route === 'tasks' ? (
              <Tasks {...shared} />
            ) : route === 'focus' ? (
              <Focus {...shared} initialTaskId={focusTaskId} />
            ) : route === 'reflection' ? (
              <Reflection {...shared} />
            ) : (
              <Settings {...shared} />
            )}
          </div>
        </main>
      </div>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
