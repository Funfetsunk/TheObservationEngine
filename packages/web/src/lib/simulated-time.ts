// tick 0 = 1 January 1991 00:00:00 UTC (Wixbury founding day)
const FOUNDING_EPOCH_MS = new Date('1991-01-01T00:00:00Z').getTime();
const MS_PER_SIM_HOUR = 60 * 60 * 1000; // 1 tick = 1 sim hour

export function tickToSimulatedDate(tick: number): Date {
  return new Date(FOUNDING_EPOCH_MS + tick * MS_PER_SIM_HOUR);
}

export function tickToISOString(tick: number): string {
  return tickToSimulatedDate(tick).toISOString();
}
