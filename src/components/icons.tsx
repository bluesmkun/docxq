import type { SVGProps } from "react"

/**
 * The handful of icons this theme draws, inlined rather than pulled from an icon
 * package: the whole set is under 3 KB and none of it needs a font or a sprite.
 * All are stroke-based on a 24 grid, so they share one weight.
 */
type P = SVGProps<SVGSVGElement>

const base = (props: P) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 16,
  height: 16,
  "aria-hidden": true as const,
  focusable: "false" as const,
  ...props,
})

export const IconBook = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
    <path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5A2.5 2.5 0 0 1 4 20.5z" />
  </svg>
)

export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
)

export const IconSun = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
  </svg>
)

export const IconMoon = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 13.5A8 8 0 0 1 10.5 4a8 8 0 1 0 9.5 9.5z" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
)

export const IconServer = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </svg>
)

export const IconActivity = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 12h4l3-8 4 16 3-8h4" />
  </svg>
)

export const IconArrowDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 4v16M6 14l6 6 6-6" />
  </svg>
)

export const IconArrowUp = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 20V4M6 10l6-6 6 6" />
  </svg>
)

export const IconArrows = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 3v18M3 17l4 4 4-4M17 21V3M13 7l4-4 4 4" />
  </svg>
)

export const IconGauge = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 18a9 9 0 1 1 16 0" />
    <path d="m12 14 4-4" />
    <circle cx="12" cy="14" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 7.8h.01" />
  </svg>
)

export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5 21 19H3z" />
    <path d="M12 9v4M12 16h.01" />
  </svg>
)

export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="m14 6-6 6 6 6" />
  </svg>
)

export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="m10 6 6 6-6 6" />
  </svg>
)

export const IconExternal = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
)

export const IconWrench = (p: P) => (
  <svg {...base(p)}>
    <path d="M14.7 6.3a4.5 4.5 0 0 0 5.9 5.9L21 21l-2 0-8.8-8.8a4.5 4.5 0 0 1-5.9-5.9L3 3l1.3 3.4" />
  </svg>
)

export const IconDot = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
)

export const IconClock = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const IconTag = (p: P) => (
  <svg {...base(p)}>
    <path d="M11 3H4v7l10 10 7-7z" />
    <circle cx="7.5" cy="6.5" r="1.2" />
  </svg>
)

export const IconGrid = (p: P) => (
  <svg {...base(p)}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" />
  </svg>
)

export const IconList = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

export const IconPanel = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M9.5 9.5V20" />
  </svg>
)

export const IconWallet = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 8.5V7a1.5 1.5 0 0 0-1.5-1.5H5.5A2.5 2.5 0 0 0 3 8v9.5A2.5 2.5 0 0 0 5.5 20H19a1 1 0 0 0 1-1V9.5a1 1 0 0 0-1-1z" />
    <path d="M3 8a2.5 2.5 0 0 1 2.5-2.5h12" />
    <circle cx="16.5" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

export const IconFilter = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 5.5h17l-6.6 7.6V20l-3.8-2v-4.9z" />
  </svg>
)

export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

export const IconSmooth = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 16.5c2.6 0 3.4-9 6-9s3.4 9 6 9 3.4-9 6-9" />
  </svg>
)
