// Canonical tick constant: 1 real minute = 1 simulated hour
// Never hardcode any time value elsewhere — all durations derive from this
export const TICK_RATE_MS = 60_000;

// Override via env var for dev/test (e.g. TICK_INTERVAL_MS=100 for fast runs)
export const TICK_INTERVAL_MS = process.env['TICK_INTERVAL_MS']
  ? parseInt(process.env['TICK_INTERVAL_MS'], 10)
  : TICK_RATE_MS;

// Stop after N sim days — unset or 0 = run forever
export const SIM_DAYS_TO_RUN = process.env['SIM_DAYS_TO_RUN']
  ? parseInt(process.env['SIM_DAYS_TO_RUN'], 10)
  : 0;

export const TICKS_PER_SIM_DAY = 24;
export const TICKS_PER_SIM_WEEK = TICKS_PER_SIM_DAY * 7; // 168 ticks = 1 simulated week = 168 real minutes
export const NEWSPAPER_EDITION_INTERVAL_TICKS = TICKS_PER_SIM_WEEK;

// From founding design doc — needs priority thresholds
export const NEED_PRIORITY_THRESHOLD = 0.2;
export const NEED_RECOVERY_TARGET = 0.4;
export const NEEDS_STARTING_VALUE = 0.8;
export const NEEDS_CRISIS_THRESHOLD = 0.1;

// Per-tick decay
export const HUNGER_DECAY_PER_TICK = 0.02;
export const ENERGY_DECAY_PER_TICK = 0.012;
export const SOCIAL_DECAY_PER_TICK = 0.015;

// Per-tick recovery while performing the relevant action
export const HUNGER_RECOVERY_PER_TICK = 0.50;
export const ENERGY_RECOVERY_PER_TICK = 0.04;
export const SOCIAL_RECOVERY_PER_TICK = 0.40;

// Work hours per day: unemployed = 0, employed = 5 + round(ambition × 5) → 5–10h
export const MIN_WORK_HOURS = 5;
export const MAX_WORK_HOURS = 10;

// Events: minimum significance to be considered for newspaper (Phase 3)
export const SIGNIFICANCE_THRESHOLD = 0.6;

// Biography: only regenerate when triggering event significance >= this
export const BIO_UPDATE_SIGNIFICANCE_THRESHOLD = 0.75;

// Newspaper: max biography updates triggered per edition (cost control)
export const MAX_BIO_UPDATES_PER_EDITION = 3;

// Relationship engine
export const RELATIONSHIP_SCORE_CHANGE_PER_TICK = 0.005;
export const RELATIONSHIP_FRIEND_THRESHOLD = 0.4;
export const RELATIONSHIP_RIVAL_THRESHOLD = -0.3;
export const RELATIONSHIP_CAP = 50;
export const RELATIONSHIP_ROMANTIC_SCORE_THRESHOLD = 0.7;
export const RELATIONSHIP_ROMANTIC_SOCIABILITY_MAX_DIFF = 0.2;

// Population dynamics (Phase 5 System 1)
export const TICKS_PER_SIM_YEAR = TICKS_PER_SIM_DAY * 365;   // 8760 ticks ≈ 6 real days
export const CITIZEN_MIN_DEATH_AGE = 60;
export const CITIZEN_MAX_DEATH_AGE = 90;
export const BIRTH_PROBABILITY_PER_TICK = 0.0002;
export const MIGRATION_PROBABILITY_PER_TICK = 0.0005;
export const CRISIS_DEATH_CONSECUTIVE_TICKS = 48;              // ~2 sim days
