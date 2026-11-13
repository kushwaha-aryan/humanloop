const paths = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.6" />
    </>
  ),
  clarity: (
    <>
      <path d="M12 3l1.7 4.8L18.5 9.5l-4.8 1.7L12 16l-1.7-4.8L5.5 9.5l4.8-1.7L12 3z" />
      <path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />
    </>
  ),
  tasks: (
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <path d="M4 6l1.4 1.4L7.8 4.6" />
      <path d="M4 12l1.4 1.4 2.4-2.8" />
      <path d="M4 18l1.4 1.4 2.4-2.8" />
    </>
  ),
  focus: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9.5V13l2.5 1.8" />
      <path d="M9.5 2.5h5" />
      <path d="M18.6 6.4l1.4-1.4" />
    </>
  ),
  reflection: (
    <>
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v16.5H7.5A2.5 2.5 0 0 0 5 21V4.5z" />
      <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H20" />
      <path d="M9.5 6.5h6M9.5 10.5h4" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2.2" />
      <circle cx="9" cy="17" r="2.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6.5L9.2 17.3 4 12.1" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  arrowRight: <path d="M4.5 12h14M13 6.5l5.5 5.5L13 17.5" />,
  arrowUpRight: <path d="M7 17L17 7M9 7h8v8" />,
  play: <path d="M7.5 4.8l11.5 7.2-11.5 7.2V4.8z" fill="currentColor" stroke="none" />,
  pause: <path d="M9 5v14M15 5v14" />,
  rotate: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
      <path d="M3.2 4.6v4.9h4.9" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V4.2h5V7" />
      <path d="M6.2 7l1 13h9.6l1-13" />
      <path d="M10 11v5.5M14 11v5.5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20.5h9" />
      <path d="M16.6 3.6a2.1 2.1 0 0 1 3 3L7 19.2l-4 1 1-4L16.6 3.6z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.7" />
      <path d="M12 7.2V12l3.2 2.1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.2" y="5" width="17.6" height="16" rx="2.2" />
      <path d="M8 3v4M16 3v4M3.2 10h17.6" />
    </>
  ),
  flag: (
    <>
      <path d="M5.5 21V4h8.8l-.9 3.2H20l-1.8 4.6L20 16.4H5.5" />
    </>
  ),
  download: <path d="M12 3.5v12M7.2 10.8L12 15.6l4.8-4.8M4.5 20.5h15" />,
  upload: <path d="M12 20.5v-12M7.2 13.2L12 8.4l4.8 4.8M4.5 3.5h15" />,
  alert: (
    <>
      <path d="M10.3 3.9L2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4.4M12 16.8h.01" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 1 3.9 10.6c-.6.5-.9 1.2-.9 2H9c0-.8-.3-1.5-.9-2A6 6 0 0 1 12 3z" />
    </>
  ),
  bolt: <path d="M13 2.5L4 14h6l-1 7.5L18 10h-6l1-7.5z" />,
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="7" />
      <path d="M16.2 16.2L21 21" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </>
  ),
  moon: <path d="M21 12.9A8.6 8.6 0 1 1 11.1 3a6.7 6.7 0 0 0 9.9 9.9z" />,
  filter: <path d="M3.5 5h17M6.5 12h11M10 19h4" />,
  external: (
    <>
      <path d="M14 3.5h6.5V10" />
      <path d="M20.5 3.5L11 13" />
      <path d="M19 14.5v5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19.5V6.5A1.5 1.5 0 0 1 4.5 5h5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.8" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  layers: (
    <>
      <path d="M12 3.5l8.5 4.6L12 12.7 3.5 8.1 12 3.5z" />
      <path d="M4.5 12.5L12 16.6l7.5-4.1M4.5 16.8L12 20.9l7.5-4.1" />
    </>
  ),
  spinner: <path d="M12 3a9 9 0 1 0 9 9" />,
  dot: <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />,
  brain: (
    <>
      <path d="M9.5 3.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.6A3 3 0 0 0 6.5 17a3 3 0 0 0 3 3.2V3.5z" />
      <path d="M14.5 3.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.6A3 3 0 0 1 17.5 17a3 3 0 0 1-3 3.2V3.5z" />
    </>
  ),
};

export const ICON_NAMES = Object.keys(paths);

export function Icon({ name, size = 18, strokeWidth = 1.7, className = '', title }) {
  const shape = paths[name] || paths.dot;
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {shape}
    </svg>
  );
}
