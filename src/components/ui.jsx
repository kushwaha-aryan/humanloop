import { forwardRef, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icons.jsx';

/* -------------------------------------------------------------------------- */
/* Buttons                                                                    */
/* -------------------------------------------------------------------------- */

export const Button = forwardRef(function Button(
  { variant = 'secondary', size = 'md', icon, iconRight, loading = false, className = '', children, ...rest },
  ref,
) {
  const iconOnly = !children;
  return (
    <button
      ref={ref}
      type="button"
      className={`btn btn-${variant} btn-${size} ${iconOnly ? 'btn-icon-only' : ''} ${className}`.trim()}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <Icon name="spinner" size={size === 'sm' ? 14 : 16} className="spin" /> : icon ? <Icon name={icon} size={size === 'sm' ? 14 : 16} /> : null}
      {children ? <span className="btn-label">{children}</span> : null}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Badges & pills                                                             */
/* -------------------------------------------------------------------------- */

export function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`badge badge-${tone} ${className}`.trim()}>
      {dot ? <span className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const tone = priority === 'High' ? 'high' : priority === 'Low' ? 'low' : 'medium';
  return <Badge tone={tone}>{priority}</Badge>;
}

export function DueBadge({ due }) {
  if (!due || due.tone === 'none') return null;
  return <Badge tone={due.tone === 'overdue' ? 'overdue' : due.tone === 'today' ? 'today' : 'neutral'}>{due.label}</Badge>;
}

/* -------------------------------------------------------------------------- */
/* Form fields                                                                */
/* -------------------------------------------------------------------------- */

export function Field({ label, hint, error, children, htmlFor, optional, className = '' }) {
  return (
    <div className={`field ${className}`.trim()}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          <span>{label}</span>
          {optional ? <span className="field-optional">optional</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = '', ...rest }, ref) {
  return <input ref={ref} className={`input ${className}`.trim()} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className = '', rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={`input textarea ${className}`.trim()} {...rest} />;
});

export const Select = forwardRef(function Select({ className = '', children, ...rest }, ref) {
  return (
    <div className="select-wrap">
      <select ref={ref} className={`input select ${className}`.trim()} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={15} className="select-chevron" />
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({ open, onClose, title, description, children, footer, size = 'md', labelledBy }) {
  const panelRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector(
        'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])',
      );
      (focusable || panelRef.current)?.focus?.();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-root" role="presentation">
      <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()} />
      <div
        className={`modal-panel modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? titleId : undefined)}
        ref={panelRef}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            {title ? (
              <h2 id={titleId} className="modal-title">
                {title}
              </h2>
            ) : null}
            {description ? <p className="modal-description">{description}</p> : null}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onClose, tone = 'danger' }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm?.();
              onClose?.();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Spinner({ size = 18 }) {
  return <Icon name="spinner" size={size} className="spin" />;
}

export function EmptyState({ icon = 'layers', title, body, action, compact = false }) {
  return (
    <div className={`empty ${compact ? 'empty-compact' : ''}`.trim()}>
      <span className="empty-icon">
        <Icon name={icon} size={compact ? 18 : 22} />
      </span>
      <div>
        <h3 className="empty-title">{title}</h3>
        {body ? <p className="empty-body">{body}</p> : null}
        {action ? <div className="empty-action">{action}</div> : null}
      </div>
    </div>
  );
}

export function InlineError({ message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="inline-error" role="alert">
      <Icon name="alert" size={18} />
      <div>
        <p>{message}</p>
        {onRetry ? (
          <button type="button" className="text-btn" onClick={onRetry}>
            {retryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function Skeleton({ lines = 3, className = '' }) {
  return (
    <div className={`skeleton ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <span key={index} className="skeleton-line" style={{ width: `${92 - index * 12}%` }} />
      ))}
    </div>
  );
}

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toast-host" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone || 'default'}`}>
          <span className="toast-mark" aria-hidden="true">
            <Icon name={toast.tone === 'error' ? 'alert' : toast.tone === 'success' ? 'check' : 'dot'} size={14} />
          </span>
          <p>{toast.message}</p>
          <button type="button" className="icon-btn icon-btn-sm" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Data display                                                               */
/* -------------------------------------------------------------------------- */

export function ProgressRing({ value = 0, size = 120, stroke = 8, label, sublabel, tone = 'accent', className = '' }) {
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className={`ring ring-${tone} ${className}`.trim()} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ? `${label}: ${clamped}%` : `${clamped}%`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="ring-value"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <strong>{label ?? `${clamped}%`}</strong>
        {sublabel ? <small>{sublabel}</small> : null}
      </div>
    </div>
  );
}

export function SectionHeader({ eyebrow, title, description, action }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {action ? <div className="section-action">{action}</div> : null}
    </div>
  );
}

export function CountPill({ value, label }) {
  return (
    <span className="count-pill">
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
