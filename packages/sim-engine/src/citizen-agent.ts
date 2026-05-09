import { Citizen, CitizenAction, CitizenTraits, DistrictId, JobType, LocationId } from '@wixbury/shared';
import {
  HUNGER_DECAY_PER_TICK,
  ENERGY_DECAY_PER_TICK,
  SOCIAL_DECAY_PER_TICK,
  HUNGER_RECOVERY_PER_TICK,
  ENERGY_RECOVERY_PER_TICK,
  SOCIAL_RECOVERY_PER_TICK,
  NEED_PRIORITY_THRESHOLD,
  NEED_RECOVERY_TARGET,
  NEEDS_STARTING_VALUE,
  MIN_WORK_HOURS,
  MAX_WORK_HOURS,
} from './constants';
import { getHomeLocation, JOB_WORK_LOCATION } from './world';

export const FIRST_NAMES_MALE: ReadonlyArray<string> = [
  'Roy', 'Derek', 'Terry', 'Barry', 'Mick', 'Dave', 'Gary', 'Ian', 'Steve',
  'John', 'Alan', 'Bob', 'Ken', 'Colin', 'Frank', 'Norman', 'Brian', 'Trevor',
];

export const FIRST_NAMES_FEMALE: ReadonlyArray<string> = [
  'Margaret', 'Sheila', 'Brenda', 'Linda', 'Susan', 'Janet', 'Karen', 'Carol',
  'Sandra', 'Beverley', 'Pauline', 'Anne', 'Joan', 'Jean', 'Vera', 'Maureen',
];

export const SURNAMES: ReadonlyArray<string> = [
  'Finch', 'Barrow', 'Voss', 'Ashcroft', 'Cartwright', 'Hobson', 'Croft',
  'Higgins', 'Fletcher', 'Dawson', 'Booth', 'Hargreaves', 'Blackwell',
  'Mawson', 'Thwaite', 'Dent', 'Nolan', 'Firth', 'Stead', 'Wray',
];

export function randFrom<T>(arr: ReadonlyArray<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function randomTraits(): CitizenTraits {
  return {
    ambition: Math.random(),
    honesty: Math.random(),
    sociability: Math.random(),
    empathy: Math.random(),
    riskTolerance: Math.random(),
    religiosity: Math.random(),
    political: Math.random(),
  };
}

function pickAction(citizen: Citizen): CitizenAction {
  const { hunger, energy, social } = citizen.needs;

  if (
    hunger < NEED_PRIORITY_THRESHOLD ||
    energy < NEED_PRIORITY_THRESHOLD ||
    social < NEED_PRIORITY_THRESHOLD
  ) {
    const lowest = Math.min(hunger, energy, social);
    if (hunger === lowest) return CitizenAction.Eating;
    if (energy === lowest) return CitizenAction.Sleeping;
    return CitizenAction.Socialising;
  }

  if (citizen.currentAction === CitizenAction.Eating && hunger < NEED_RECOVERY_TARGET) {
    return CitizenAction.Eating;
  }
  if (citizen.currentAction === CitizenAction.Sleeping && energy < NEED_RECOVERY_TARGET) {
    return CitizenAction.Sleeping;
  }
  if (citizen.currentAction === CitizenAction.Socialising && social < NEED_RECOVERY_TARGET) {
    return CitizenAction.Socialising;
  }

  if (citizen.workedTodayTicks >= citizen.dailyWorkTarget) {
    return CitizenAction.Leisure;
  }

  return CitizenAction.Working;
}

function pickLocation(action: CitizenAction, citizen: Citizen): LocationId {
  const districtId = citizen.homeDistrictId as DistrictId;
  switch (action) {
    case CitizenAction.Sleeping: return getHomeLocation(districtId);
    case CitizenAction.Eating: return getHomeLocation(districtId);
    case CitizenAction.Working: return JOB_WORK_LOCATION[citizen.job];
    case CitizenAction.Socialising:
      return citizen.traits.religiosity > 0.7
        ? LocationId.StAlfredsChurch
        : LocationId.MinersRest;
    case CitizenAction.Leisure:
      return citizen.traits.sociability > 0.6
        ? LocationId.MinersRest
        : getHomeLocation(districtId);
  }
}

export function createCitizen(
  districtId: DistrictId = DistrictId.Millside,
  jobType?: JobType,
): Citizen {
  const isMale = Math.random() < 0.5;
  const firstName = isMale ? randFrom(FIRST_NAMES_MALE) : randFrom(FIRST_NAMES_FEMALE);
  const job = jobType ?? randFrom(Object.values(JobType) as JobType[]);
  const traits = randomTraits();
  const dailyWorkTarget =
    job === JobType.Unemployed
      ? 0
      : Math.round(MIN_WORK_HOURS + traits.ambition * (MAX_WORK_HOURS - MIN_WORK_HOURS));
  const initialAction = job === JobType.Unemployed ? CitizenAction.Leisure : CitizenAction.Working;

  return {
    id: crypto.randomUUID(),
    name: `${firstName} ${randFrom(SURNAMES)}`,
    age: Math.floor(Math.random() * 47) + 18,
    job,
    homeDistrictId: districtId,
    currentLocationId: JOB_WORK_LOCATION[job],
    traits,
    needs: {
      hunger: NEEDS_STARTING_VALUE,
      energy: NEEDS_STARTING_VALUE,
      social: NEEDS_STARTING_VALUE,
    },
    currentAction: initialAction,
    dailyWorkTarget,
    workedTodayTicks: 0,
    wealth: 0,
  };
}

export function tickCitizen(citizen: Citizen): CitizenAction {
  citizen.needs.hunger = clamp(citizen.needs.hunger - HUNGER_DECAY_PER_TICK);
  citizen.needs.energy = clamp(citizen.needs.energy - ENERGY_DECAY_PER_TICK);
  citizen.needs.social = clamp(citizen.needs.social - SOCIAL_DECAY_PER_TICK);

  const action = pickAction(citizen);
  citizen.currentAction = action;

  switch (action) {
    case CitizenAction.Eating:
      citizen.needs.hunger = clamp(citizen.needs.hunger + HUNGER_RECOVERY_PER_TICK);
      break;
    case CitizenAction.Sleeping:
      citizen.needs.energy = clamp(citizen.needs.energy + ENERGY_RECOVERY_PER_TICK);
      break;
    case CitizenAction.Socialising:
      citizen.needs.social = clamp(citizen.needs.social + SOCIAL_RECOVERY_PER_TICK);
      break;
    case CitizenAction.Working:
      citizen.workedTodayTicks++;
      break;
    case CitizenAction.Leisure:
      break;
  }

  citizen.currentLocationId = pickLocation(action, citizen);

  return action;
}
