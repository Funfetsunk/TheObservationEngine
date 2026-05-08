export enum JobType {
  Unemployed = 'unemployed',
  Labourer = 'labourer',
  Shopkeeper = 'shopkeeper',
  Teacher = 'teacher',
  Doctor = 'doctor',
  Councillor = 'councillor',
  Journalist = 'journalist',
  Publican = 'publican',
  FactoryWorker = 'factory_worker',
  Clergy = 'clergy',
  Footballer = 'footballer',
}

export enum CitizenAction {
  Eating = 'eating',
  Sleeping = 'sleeping',
  Socialising = 'socialising',
  Working = 'working',
  Leisure = 'leisure',
}

export interface CitizenTraits {
  ambition: number;
  honesty: number;
  sociability: number;
  empathy: number;
  riskTolerance: number;
  religiosity: number;
  political: number;
}

export interface CitizenNeeds {
  hunger: number;
  energy: number;
  social: number;
}

export interface Citizen {
  id: string;
  name: string;
  age: number;
  job: JobType;
  homeDistrictId: string;
  currentLocationId: string;
  traits: CitizenTraits;
  needs: CitizenNeeds;
  currentAction: CitizenAction;
  dailyWorkTarget: number;
  workedTodayTicks: number;
}
