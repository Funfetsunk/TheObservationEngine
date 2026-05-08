import { Citizen, CitizenAction, CitizenNeeds } from '@wixbury/shared';
import { tickCitizen } from './citizen-agent';
import { POC_TICK_INTERVAL_MS, TICKS_PER_SIM_DAY, SIM_DAYS_TO_RUN } from './constants';

export type ActionCounts = Record<CitizenAction, number>;

export type DayCompleteCallback = (
  day: number,
  actionCounts: ActionCounts,
  endOfDayNeeds: CitizenNeeds,
) => void;

function emptyActionCounts(): ActionCounts {
  return {
    [CitizenAction.Eating]: 0,
    [CitizenAction.Sleeping]: 0,
    [CitizenAction.Socialising]: 0,
    [CitizenAction.Working]: 0,
    [CitizenAction.Leisure]: 0,
  };
}

export function startTickEngine(
  citizen: Citizen,
  onDayComplete: DayCompleteCallback,
  onSimComplete: () => void,
): void {
  let tick = 0;
  const totalTicks = TICKS_PER_SIM_DAY * SIM_DAYS_TO_RUN;
  let actionCounts = emptyActionCounts();

  const interval = setInterval(() => {
    try {
      const action = tickCitizen(citizen);
      actionCounts[action]++;
      tick++;

      if (tick % TICKS_PER_SIM_DAY === 0) {
        const day = tick / TICKS_PER_SIM_DAY;
        onDayComplete(day, { ...actionCounts }, { ...citizen.needs });
        actionCounts = emptyActionCounts();
        citizen.workedTodayTicks = 0;
      }

      if (tick >= totalTicks) {
        clearInterval(interval);
        onSimComplete();
      }
    } catch (err) {
      console.error(`Tick ${tick} error:`, err instanceof Error ? err.message : err);
    }
  }, POC_TICK_INTERVAL_MS);
}
