import { Citizen, EventType, JobType } from '@wixbury/shared';

const PROMINENT_JOBS: ReadonlySet<string> = new Set<JobType>([
  JobType.Journalist,
  JobType.Councillor,
  JobType.Doctor,
]);

const NOTEWORTHY_JOBS: ReadonlySet<string> = new Set<JobType>([
  JobType.Clergy,
  JobType.Teacher,
  JobType.Publican,
]);

const BASE_SIGNIFICANCE: Record<EventType, number> = {
  [EventType.RelationshipChanged]: 0.50,
  [EventType.RelationshipFormed]: 0.20,
  [EventType.NeedsCrisis]: 0.40,
  [EventType.PubVisit]: 0.10,
  [EventType.ChurchVisit]: 0.15,
  [EventType.WorkplaceIncident]: 0.35,
  [EventType.CitizenBorn]: 0.70,
  [EventType.CitizenDied]: 0.80,
  [EventType.CitizenMigrated]: 0.30,
  [EventType.BuildingConstructed]: 0.65,
  [EventType.BuildingDemolished]: 0.60,
  [EventType.DistrictEvolved]: 0.70,
  [EventType.ElectionHeld]: 0.90,
  [EventType.PolicyPassed]: 0.75,
  [EventType.FactionFormed]: 0.65,
  [EventType.CorruptionAllegation]: 0.85,
  [EventType.BusinessOpened]: 0.65,
  [EventType.BusinessClosed]: 0.70,
  [EventType.Promotion]: 0.55,
  [EventType.UnemploymentSpike]: 0.80,
  [EventType.Strike]: 0.85,
  [EventType.YearClosed]: 0.50,
  [EventType.CitizenGraduated]: 0.35,
};

export function scoreSignificance(
  type: EventType,
  involvedCitizens: readonly Citizen[],
): number {
  const base = BASE_SIGNIFICANCE[type] ?? 0.10;
  let prominenceBoost = 0;
  for (const citizen of involvedCitizens) {
    if (PROMINENT_JOBS.has(citizen.job)) {
      prominenceBoost = Math.max(prominenceBoost, 0.20);
    } else if (NOTEWORTHY_JOBS.has(citizen.job)) {
      prominenceBoost = Math.max(prominenceBoost, 0.10);
    }
  }
  if (type === EventType.CitizenGraduated) {
    const graduate = involvedCitizens[0];
    if (graduate && graduate.traits.ambition > 0.85) {
      prominenceBoost = Math.max(prominenceBoost, 0.20);
    }
  }
  return Math.min(1.0, base + prominenceBoost);
}
