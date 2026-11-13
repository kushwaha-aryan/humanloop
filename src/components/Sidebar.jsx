import { Icon } from './Icons.jsx';
import { BrandLockup } from './Brand.jsx';
import { formatDuration } from '../lib/fmt.js';

export const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'clarity', label: 'AI Clarity', icon: 'clarity' },
  { id: 'tasks', label: 'My Tasks', icon: 'tasks' },
  { id: 'focus', label: 'Focus Mode', icon: 'focus' },
  { id: 'reflection', label: 'Reflection', icon: 'reflection' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MODE_COPY = {
  live: { label: 'Live AI', detail: 'Groq connected' },
  demo: { label: 'Demo mode', detail: 'Sample responses' },
  offline: { label: 'Server offline', detail: 'AI unavailable' },
  loading: { label: 'Checking server', detail: 'One moment' },
};

export function Sidebar({ route, onNavigate, open, onClose, stats, health, profile, timer }) {
  const mode = health.status === 'loading' ? 'loading' : health.mode || 'offline';
  const modeCopy = MODE_COPY[mode] || MODE_COPY.offline;

  return (
    <>
      <div className={`sidebar-scrim ${open ? 'is-visible' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-top">
          <BrandLockup onClick={() => onNavigate('overview')} />
          <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close navigation">
            <Icon name="x" size={18} />
          </button>
        </div>

        <nav className="nav">
          <p className="nav-label">Workspace</p>
          {NAV_ITEMS.filter((item) => item.id !== 'settings').map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${route === item.id ? 'is-active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={route === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
              {item.id === 'tasks' && stats.pending > 0 ? <span className="nav-count">{stats.pending}</span> : null}
              {item.id === 'focus' && timer?.runningSince ? <span className="nav-live" aria-label="Focus timer running" /> : null}
            </button>
          ))}

          <p className="nav-label nav-label-spaced">Account</p>
          <button
            type="button"
            className={`nav-item ${route === 'settings' ? 'is-active' : ''}`}
            onClick={() => onNavigate('settings')}
            aria-current={route === 'settings' ? 'page' : undefined}
          >
            <Icon name="settings" size={18} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-today" aria-label="Today at a glance">
          <div className="sidebar-today-head">
            <span className="mini-label">Today</span>
            <span className="mini-value">{stats.completionPct}%</span>
          </div>
          <div className="mini-bar" role="presentation">
            <span style={{ width: `${stats.completionPct}%` }} />
          </div>
          <div className="mini-stats">
            <div>
              <span className="mini-label">Done</span>
              <strong>{stats.completedToday}</strong>
            </div>
            <div>
              <span className="mini-label">Focus</span>
              <strong>{formatDuration(stats.focusMinutesToday)}</strong>
            </div>
            <div>
              <span className="mini-label">Open</span>
              <strong>{stats.pending}</strong>
            </div>
          </div>
        </div>

        <div className="sidebar-foot">
          <button type="button" className="mode-status" onClick={() => onNavigate('settings')}>
            <span className={`status-dot status-${mode}`} aria-hidden="true" />
            <span className="mode-status-text">
              <span>{modeCopy.label}</span>
              <small>{modeCopy.detail}</small>
            </span>
            <Icon name="arrowUpRight" size={13} className="mode-status-arrow" />
          </button>
          <button type="button" className="profile-chip" onClick={() => onNavigate('settings')}>
            <span className="avatar">{(profile.name || 'H').trim().charAt(0).toUpperCase()}</span>
            <span className="profile-name">{profile.name || 'Set your name'}</span>
            <Icon name="settings" size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
