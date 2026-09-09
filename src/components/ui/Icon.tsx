import type { SVGProps } from 'react';

/**
 * Kleine Inline-Icon-Sammlung.
 * Bewusst keine Icon-Bibliothek: das spart ein zusätzliches Paket und hält das
 * ausgelieferte JavaScript klein.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number; title?: string };

function Svg({ size = 20, title, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const Icons = {
  community: (props: IconProps) => (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  ),
  tournament: (props: IconProps) => (
    <Svg {...props}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M6 3h12v6a6 6 0 0 1-12 0z" />
      <path d="M12 15v4M8 22h8" />
    </Svg>
  ),
  discord: (props: IconProps) => (
    <Svg {...props} strokeWidth="0" fill="currentColor">
      <path d="M19.27 5.33A16.5 16.5 0 0 0 15.2 4l-.23.44a12.6 12.6 0 0 1 3.6 1.85 15.5 15.5 0 0 0-13.15 0A12.6 12.6 0 0 1 9.03 4.4L8.8 4a16.5 16.5 0 0 0-4.07 1.33C2.15 9.2 1.45 12.97 1.8 16.68a16.6 16.6 0 0 0 5.06 2.57l1.1-1.7a10.8 10.8 0 0 1-1.7-.82l.42-.33a11.85 11.85 0 0 0 10.65 0l.42.33c-.54.32-1.11.6-1.7.82l1.1 1.7a16.55 16.55 0 0 0 5.05-2.57c.42-4.3-.7-8.03-2.93-11.35ZM8.52 14.42c-.98 0-1.79-.9-1.79-2s.79-2 1.79-2 1.8.9 1.79 2c0 1.1-.79 2-1.79 2Zm6.96 0c-.98 0-1.79-.9-1.79-2s.79-2 1.79-2 1.8.9 1.79 2c0 1.1-.79 2-1.79 2Z" />
    </Svg>
  ),
  calendar: (props: IconProps) => (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  ),
  shield: (props: IconProps) => (
    <Svg {...props}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  ),
  star: (props: IconProps) => (
    <Svg {...props}>
      <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  ),
  chat: (props: IconProps) => (
    <Svg {...props}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  ),
  swiss: (props: IconProps) => (
    <Svg {...props} strokeWidth="0" fill="currentColor">
      <rect x="3" y="3" width="18" height="18" rx="3" opacity="0.25" />
      <path d="M10.4 6h3.2v4.4H18v3.2h-4.4V18h-3.2v-4.4H6v-3.2h4.4z" />
    </Svg>
  ),
  instagram: (props: IconProps) => (
    <Svg {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  ),
  tiktok: (props: IconProps) => (
    <Svg {...props} strokeWidth="0" fill="currentColor">
      <path d="M16.5 2h-3v13.2a2.6 2.6 0 1 1-2.2-2.57v-3.05a5.65 5.65 0 1 0 5.2 5.62V9.1a6.6 6.6 0 0 0 3.9 1.26V7.3a3.75 3.75 0 0 1-3.9-3.62z" />
    </Svg>
  ),
  youtube: (props: IconProps) => (
    <Svg {...props}>
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="m10.5 9.5 5 2.5-5 2.5z" fill="currentColor" stroke="none" />
    </Svg>
  ),
  twitch: (props: IconProps) => (
    <Svg {...props}>
      <path d="M4 3h16v11l-4 4h-3l-3 3H8v-3H4z" />
      <path d="M11 8v4M15 8v4" />
    </Svg>
  ),
  external: (props: IconProps) => (
    <Svg {...props} size={props.size ?? 14}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6M10 14 21 3" />
    </Svg>
  ),
  arrowRight: (props: IconProps) => (
    <Svg {...props} size={props.size ?? 16}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  check: (props: IconProps) => (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  ),
  alert: (props: IconProps) => (
    <Svg {...props}>
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </Svg>
  ),
  info: (props: IconProps) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </Svg>
  ),
  play: (props: IconProps) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m10 8 6 4-6 4z" fill="currentColor" />
    </Svg>
  ),
  menu: (props: IconProps) => (
    <Svg {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  ),
  close: (props: IconProps) => (
    <Svg {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  ),
  clock: (props: IconProps) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  users: (props: IconProps) => (
    <Svg {...props}>
      <path d="M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19" />
      <circle cx="9" cy="7" r="3.2" />
      <path d="M22 19v-1.5a4 4 0 0 0-3-3.87M16 4.13a4 4 0 0 1 0 5.74" />
    </Svg>
  ),
  bolt: (props: IconProps) => (
    <Svg {...props}>
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </Svg>
  ),
  mail: (props: IconProps) => (
    <Svg {...props}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </Svg>
  ),
  sun: (props: IconProps) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.22 4.22l1.56 1.56M18.22 18.22l1.56 1.56M2.5 12h2.2M19.3 12h2.2M4.22 19.78l1.56-1.56M18.22 5.78l1.56-1.56" />
    </Svg>
  ),
  moon: (props: IconProps) => (
    <Svg {...props}>
      <path d="M20.5 14.3A8.6 8.6 0 0 1 9.7 3.5a8.6 8.6 0 1 0 10.8 10.8Z" />
    </Svg>
  ),
} as const;

export type IconName = keyof typeof Icons;
