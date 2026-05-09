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
  return Math.min(1.0, base + prominenceBoost);
}
