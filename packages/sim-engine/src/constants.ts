// Canonical tick constant: 1 real minute = 1 simulated hour
// Never hardcode any time value elsewhere — all durations derive from this
export const TICK_RATE_MS = 60_000;

// Phase 1 POC: 100ms/tick so 100 sim days (~2400 ticks) completes in ~4 minutes
// Phase 2+: use TICK_RATE_MS directly
export const POC_TICK_INTERVAL_MS = 100;

export const TICKS_PER_SIM_DAY = 24;
export const SIM_DAYS_TO_RUN = 100;

// From founding design doc — needs priority thresholds
export const NEED_PRIORITY_THRESHOLD = 0.2;
export const NEED_RECOVERY_TARGET = 0.4;
export const NEEDS_STARTING_VALUE = 0.8;

// Per-tick decay (needs fall this much each tick regardless of action)
// Tuned so each need hits 0.2 roughly once per sim day in steady state
export const HUNGER_DECAY_PER_TICK = 0.02;  // crisis ~every 20 ticks from 0.6
export const ENERGY_DECAY_PER_TICK = 0.012; // 0.40→0.20 in ~17 ticks → ~17h awake before sleep
export const SOCIAL_DECAY_PER_TICK = 0.015; // crisis ~every 2-3 days

// Per-tick recovery while performing the relevant action
// Fast recovery so citizen clears a need in 1-2 ticks and returns to work
export const HUNGER_RECOVERY_PER_TICK = 0.50;
export const ENERGY_RECOVERY_PER_TICK = 0.04; // net +0.028/tick → 0.20→0.40 in ~7 ticks (7h sleep)
export const SOCIAL_RECOVERY_PER_TICK = 0.40;

// Work hours per day: unemployed = 0, employed = 5 + round(ambition × 5) → 5–10h
export const MIN_WORK_HOURS = 5;
export const MAX_WORK_HOURS = 10;
