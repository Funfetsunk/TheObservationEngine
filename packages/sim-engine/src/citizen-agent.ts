import { Citizen, CitizenAction, CitizenTraits, JobType } from '@wixbury/shared';
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

const FIRST_NAMES_MALE: ReadonlyArray<string> = [
  'Roy', 'Derek', 'Terry', 'Barry', 'Mick', 'Dave', 'Gary', 'Ian', 'Steve',
  'John', 'Alan', 'Bob', 'Ken', 'Colin', 'Frank', 'Norman', 'Brian', 'Trevor',
];

const FIRST_NAMES_FEMALE: ReadonlyArray<string> = [
  'Margaret', 'Sheila', 'Brenda', 'Linda', 'Susan', 'Janet', 'Karen', 'Carol',
  'Sandra', 'Beverley', 'Pauline', 'Anne', 'Joan', 'Jean', 'Vera', 'Maureen',
];

const SURNAMES: ReadonlyArray<string> = [
  'Finch', 'Barrow', 'Voss', 'Ashcroft', 'Cartwright', 'Hobson', 'Croft',
  'Higgins', 'Fletcher', 'Dawson', 'Booth', 'Hargreaves', 'Blackwell',
  'Mawson', 'Thwaite', 'Dent', 'Nolan', 'Firth', 'Stead', 'Wray',
];

const JOB_TYPES: ReadonlyArray<JobType> = Object.values(JobType);

function randFrom<T>(arr: ReadonlyArray<T>): T {
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

export function createCitizen(): Citizen {
  const isMale = Math.random() < 0.5;
  const firstName = isMale ? randFrom(FIRST_NAMES_MALE) : randFrom(FIRST_NAMES_FEMALE);
  const job = randFrom(JOB_TYPES);
  const traits = randomTraits();
  const dailyWorkTarget =
    job === JobType.Unemployed
      ? 0
      : Math.round(MIN_WORK_HOURS + traits.ambition * (MAX_WORK_HOURS - MIN_WORK_HOURS));
  return {
    name: `${firstName} ${randFrom(SURNAMES)}`,
    age: Math.floor(Math.random() * 47) + 18,
    job,
    traits,
    needs: {
      hunger: NEEDS_STARTING_VALUE,
      energy: NEEDS_STARTING_VALUE,
      social: NEEDS_STARTING_VALUE,
    },
    currentAction: CitizenAction.Working,
    dailyWorkTarget,
    workedTodayTicks: 0,
  };
}

function pickAction(citizen: Citizen): CitizenAction {
  const { hunger, energy, social } = citizen.needs;

  // Any need below the priority threshold overrides all else — worst need wins
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

  // Continue mid-recovery until the recovery target is reached
  if (citizen.currentAction === CitizenAction.Eating && hunger < NEED_RECOVERY_TARGET) {
    return CitizenAction.Eating;
  }
  if (citizen.currentAction === CitizenAction.Sleeping && energy < NEED_RECOVERY_TARGET) {
    return CitizenAction.Sleeping;
  }
  if (citizen.currentAction === CitizenAction.Socialising && social < NEED_RECOVERY_TARGET) {
    return CitizenAction.Socialising;
  }

  // Work quota met → leisure for the rest of the day
  if (citizen.workedTodayTicks >= citizen.dailyWorkTarget) {
    return CitizenAction.Leisure;
  }

  return CitizenAction.Working;
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

  return action;
}
