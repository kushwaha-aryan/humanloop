export function BrandMark({ size = 30 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.66} height={size * 0.66} fill="none" stroke="currentColor" strokeLinecap="round">
        <circle cx="12" cy="12" r="8.2" strokeWidth="1.5" opacity="0.35" />
        <path d="M12 3.8a8.2 8.2 0 0 1 5.8 14" strokeWidth="2.1" />
        <path d="M12 3.8a8.2 8.2 0 0 0-5.8 14" strokeWidth="2.1" opacity="0.55" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function BrandLockup({ onClick, compact = false }) {
  const content = (
    <>
      <BrandMark size={compact ? 26 : 32} />
      <span className="brand-text">
        <span className="brand-name">HumanLoop</span>
        {!compact ? <span className="brand-tag">From chaos to next action</span> : null}
      </span>
    </>
  );

  if (!onClick) return <div className="brand">{content}</div>;
  return (
    <button type="button" className="brand brand-button" onClick={onClick} aria-label="HumanLoop — go to Overview">
      {content}
    </button>
  );
}
