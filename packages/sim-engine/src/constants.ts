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
export const MIN_ROMANTIC_AGE = 18;   // no romantic relationships under 18
export const MIN_SOCIAL_AGE = 5;      // under 5: only parent relationships

// District evolution (Phase 5 System 4)
export const DISTRICT_WEALTH_DRIFT_RATE = 0.30;          // lerp factor per year toward target wealthScore
export const DISTRICT_WEALTH_NORMALIZATION_CAP = 5000;   // wealth value that maps to wealthScore = 1.0
export const BUILDING_CONSTRUCTION_INTERVAL_TICKS = TICKS_PER_SIM_DAY * 365;
export const BUILDING_CONSTRUCTION_WEALTH_COST = 1000;
export const BUILDING_CONSTRUCTION_PROBABILITY = 0.30;
export const BUILDING_DEMOLITION_PROBABILITY = 0.02;
export const BUILDING_MIN_AGE_FOR_DEMOLITION_TICKS = TICKS_PER_SIM_DAY * 365 * 3; // 3 sim years

// Political system (Phase 5 System 3)
export const TICKS_PER_SIM_MONTH = TICKS_PER_SIM_DAY * 30;           // 720 ticks
export const ELECTION_INTERVAL_TICKS = TICKS_PER_SIM_DAY * 365 * 4;  // 4 sim years
export const COUNCIL_SEATS = 5;
export const POLICY_VOTE_THRESHOLD = 3;
export const FACTION_FORMATION_THRESHOLD = 5;
export const FACTION_POLITICAL_SIMILARITY = 0.2;
export const CANDIDATE_DECLARATION_PROBABILITY = 0.30;
export const CORRUPTION_PROBABILITY_PER_WEEK = 0.05;

// Economy engine (Phase 5 System 2)
export const WAGE_PER_TICK: Record<string, number> = {
  unemployed:     0,
  labourer:       2,
  factory_worker: 2,
  shopkeeper:     3,
  teacher:        4,
  publican:       3,
  footballer:     5,
  doctor:         7,
  journalist:     4,
  clergy:         2,
  councillor:     5,
};
export const BUSINESS_OPEN_WEALTH_THRESHOLD = 150;
export const BUSINESS_OPEN_PROBABILITY_PER_WEEK = 0.20;
export const BUSINESS_INSOLVENCY_THRESHOLD = 30;
export const BUSINESS_SALE_PRICE = 100;
export const BUSINESS_CAPACITY: Record<string, number> = {
  pub:     5,
  shop:    3,
  factory: 12,
  clinic:  4,
  school:  5,
  church:  2,
};
export const BUSINESS_OPERATING_COST_PER_WEEK: Record<string, number> = {
  pub:     40,
  shop:    25,
  factory: 70,
  clinic:  50,
  school:  35,
  church:  15,
};
export const JOB_CHANGE_WEALTH_THRESHOLD = 200;
export const JOB_CHANGE_CHECK_INTERVAL_TICKS = TICKS_PER_SIM_WEEK;
export const JOB_PROMOTION_PROBABILITY = 0.10;
export const JOB_SEEK_PROBABILITY = 0.85;
export const UNEMPLOYMENT_SPIKE_THRESHOLD = 0.20;
export const STRIKE_THRESHOLD = 0.30;

// School system
export const SCHOOL_MIN_AGE = 4;
export const SCHOOL_MAX_AGE = 17;
export const SCHOOL_START_HOUR = 8;
export const SCHOOL_END_HOUR = 16;                        // exclusive (hours 8–15 attend)
export const SCHOOL_HUNGER_RECOVERY_PER_TICK = 0.12;
export const SCHOOL_SOCIAL_RECOVERY_PER_TICK = 0.20;
export const SCHOOL_TRAIT_GAIN_PER_TICK = 0.000005;       // 5e-6 → ~0.135 gain over full career
export const SCHOOL_AMBITION_MULTIPLIER = 0.4;

// Population dynamics (Phase 5 System 1)
export const TICKS_PER_SIM_YEAR = TICKS_PER_SIM_DAY * 365;   // 8760 ticks ≈ 6 real days
export const MIN_WORKING_AGE = 18;
export const CITIZEN_MIN_DEATH_AGE = 60;
export const CITIZEN_MAX_DEATH_AGE = 90;
export const BIRTH_PROBABILITY_PER_TICK = 0.0002;
export const COUPLE_MAX_CHILDREN_MIN = 1;
export const COUPLE_MAX_CHILDREN_MAX = 4;
export const MIGRATION_PROBABILITY_PER_TICK = 0.0005;
export const CRISIS_DEATH_CONSECUTIVE_TICKS = 48;              // ~2 sim days

// Historical archive (Phase 5 System 5)
export const HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD = 0.65;
