/** Centralized motion tokens (FRONTEND_SPEC §6.2). No ad-hoc durations. */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  celebrate: 0.6,
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  accelerate: [0.4, 0, 1, 1],
  emphasized: [0.2, 0, 0, 1],
} as const;

export const spring = {
  default: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  gentle: { type: 'spring', stiffness: 180, damping: 26 },
  snappy: { type: 'spring', stiffness: 500, damping: 32 },
} as const;
