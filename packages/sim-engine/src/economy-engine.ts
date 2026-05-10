import { PrismaClient } from '@wixbury/db';
import { Business, BusinessType, Citizen, CitizenAction, DistrictId, EventType, JobType } from '@wixbury/shared';
import {
  BUSINESS_FAIL_PROBABILITY_PER_WEEK,
  BUSINESS_OPEN_PROBABILITY_PER_WEEK,
  BUSINESS_OPEN_WEALTH_THRESHOLD,
  JOB_CHANGE_WEALTH_THRESHOLD,
  JOB_PROMOTION_PROBABILITY,
  JOB_SEEK_PROBABILITY,
  MIN_WORK_HOURS,
  MAX_WORK_HOURS,
  MIN_WORKING_AGE,
  STRIKE_THRESHOLD,
  UNEMPLOYMENT_SPIKE_THRESHOLD,
  WAGE_PER_TICK,
} from './constants';
import { PendingEvent } from './event-emitter';
import { scoreSignificance } from './significance-scorer';
import { syncBusinessToDb } from './db-sync';
import { activePolicyEffects } from './policy-effects';

const BUSINESS_NAMES: Record<BusinessType, string[]> = {
  [BusinessType.Pub]: ['The Crown', 'The Red Lion', 'The Bull & Gate', 'The Swan', 'The White Hart', 'The Plough'],
  [BusinessType.Shop]: ["Barrow's General", "Fletcher's Supplies", "Finch & Sons", "Hobson's Store", "Croft's"],
  [BusinessType.Factory]: ['Wixbury Mills', 'Northern Works', 'Croft Manufacturing', 'Ashcroft & Sons'],
  [BusinessType.Clinic]: ['Wixbury Surgery', 'The Health Centre', 'Millside Clinic', 'Harrowgate Practice'],
  [BusinessType.School]: ['Wixbury Academy', 'Northern College', 'The Technical Institute'],
  [BusinessType.Church]: ["St Mary's", "St James's", 'Holy Trinity', 'Our Lady of Wixbury'],
};

const JOB_BUSINESS_TYPE: Partial<Record<JobType, BusinessType>> = {
  [JobType.Publican]: BusinessType.Pub,
  [JobType.Shopkeeper]: BusinessType.Shop,
  [JobType.FactoryWorker]: BusinessType.Factory,
  [JobType.Doctor]: BusinessType.Clinic,
  [JobType.Teacher]: BusinessType.School,
  [JobType.Clergy]: BusinessType.Church,
};

const PROMOTION_PATHS: Partial<Record<JobType, JobType[]>> = {
  [JobType.Labourer]: [JobType.FactoryWorker, JobType.Shopkeeper],
  [JobType.FactoryWorker]: [JobType.Shopkeeper, JobType.Publican],
  [JobType.Shopkeeper]: [JobType.Journalist, JobType.Teacher],
  [JobType.Publican]: [JobType.Journalist],
  [JobType.Teacher]: [JobType.Doctor],
  [JobType.Journalist]: [JobType.Doctor],
};

function randFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickBusinessName(type: BusinessType): string {
  return randFrom(BUSINESS_NAMES[type]);
}

export class EconomyEngine {
  private lastUnemploymentSpikeTick = -1000;

  tickWages(citizens: Citizen[]): void {
    for (const citizen of citizens) {
      if (citizen.currentAction === CitizenAction.Working) {
        citizen.wealth += (WAGE_PER_TICK[citizen.job] ?? 0) * activePolicyEffects.wageMultiplier;
      }
    }
  }

  async checkBusinessOpportunities(
    citizens: Citizen[],
    businesses: Business[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const openBusinessOwners = new Set(
      businesses.filter(b => b.closedAt === null && b.ownerId !== null).map(b => b.ownerId!),
    );

    for (const citizen of citizens) {
      if (openBusinessOwners.has(citizen.id)) continue;
      if (citizen.wealth < BUSINESS_OPEN_WEALTH_THRESHOLD) continue;
      if (citizen.traits.ambition <= 0.55) continue;
      if (Math.random() >= BUSINESS_OPEN_PROBABILITY_PER_WEEK) continue;

      const businessType = JOB_BUSINESS_TYPE[citizen.job] ?? BusinessType.Shop;
      const name = pickBusinessName(businessType);
      const business: Business = {
        id: crypto.randomUUID(),
        name,
        type: businessType,
        districtId: citizen.homeDistrictId,
        ownerId: citizen.id,
        openedAt: tickNumber,
        closedAt: null,
        employeeIds: [citizen.id],
      };

      await prisma.business.create({
        data: {
          id: business.id,
          name: business.name,
          type: business.type,
          districtId: business.districtId,
          ownerId: business.ownerId,
          openedAt: business.openedAt,
          employeeIds: business.employeeIds,
        },
      });

      citizen.wealth -= BUSINESS_OPEN_WEALTH_THRESHOLD;
      businesses.push(business);

      events.push({
        type: EventType.BusinessOpened,
        occurredAt: tickNumber,
        citizenIds: [citizen.id],
        data: { businessName: name, businessType, ownerName: citizen.name, districtId: citizen.homeDistrictId },
        significance: scoreSignificance(EventType.BusinessOpened, [citizen]),
      });
    }

    return events;
  }

  async checkBusinessFailures(
    citizens: Citizen[],
    businesses: Business[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const citizenMap = new Map(citizens.map(c => [c.id, c]));

    for (const business of businesses) {
      if (business.closedAt !== null) continue;
      if (Math.random() >= BUSINESS_FAIL_PROBABILITY_PER_WEEK) continue;

      business.closedAt = tickNumber;
      await syncBusinessToDb(business, prisma);

      const displaced: Citizen[] = [];
      for (const empId of business.employeeIds) {
        const emp = citizenMap.get(empId);
        if (emp) {
          emp.job = JobType.Unemployed;
          emp.dailyWorkTarget = 0;
          displaced.push(emp);
        }
      }

      const avgHonesty =
        displaced.length > 0
          ? displaced.reduce((sum, c) => sum + c.traits.honesty, 0) / displaced.length
          : 1;

      const involvedCitizens = displaced.length > 0 ? displaced : citizens.slice(0, 1);
      events.push({
        type: EventType.BusinessClosed,
        occurredAt: tickNumber,
        citizenIds: business.employeeIds,
        data: { businessName: business.name, businessType: business.type, displaced: displaced.length },
        significance: scoreSignificance(EventType.BusinessClosed, involvedCitizens),
      });

      // Disgruntled workers with low collective honesty may strike
      if (displaced.length > 1 && avgHonesty < 0.4 && Math.random() < 0.20) {
        events.push({
          type: EventType.Strike,
          occurredAt: tickNumber,
          citizenIds: business.employeeIds,
          data: { businessName: business.name, workers: displaced.length },
          significance: scoreSignificance(EventType.Strike, displaced),
        });
      }
    }

    return events;
  }

  async checkJobChanges(
    citizens: Citizen[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];

    for (const citizen of citizens) {
      if (citizen.age < MIN_WORKING_AGE) continue;

      if (citizen.job === JobType.Unemployed) {
        if (Math.random() < JOB_SEEK_PROBABILITY) {
          const entryJobs = [JobType.Labourer, JobType.FactoryWorker, JobType.Shopkeeper];
          citizen.job = randFrom(entryJobs);
          citizen.dailyWorkTarget = Math.round(
            MIN_WORK_HOURS + citizen.traits.ambition * (MAX_WORK_HOURS - MIN_WORK_HOURS),
          );
          await prisma.citizen.update({ where: { id: citizen.id }, data: { jobType: citizen.job } });
        }
        continue;
      }

      if (citizen.traits.ambition <= 0.7) continue;
      if (citizen.wealth < JOB_CHANGE_WEALTH_THRESHOLD) continue;
      if (Math.random() >= JOB_PROMOTION_PROBABILITY) continue;

      const targets = PROMOTION_PATHS[citizen.job];
      if (!targets || targets.length === 0) continue;

      const prevJob = citizen.job;
      citizen.job = randFrom(targets);
      citizen.dailyWorkTarget = Math.round(
        MIN_WORK_HOURS + citizen.traits.ambition * (MAX_WORK_HOURS - MIN_WORK_HOURS),
      );
      await prisma.citizen.update({ where: { id: citizen.id }, data: { jobType: citizen.job } });

      events.push({
        type: EventType.Promotion,
        occurredAt: tickNumber,
        citizenIds: [citizen.id],
        data: { citizenName: citizen.name, from: prevJob, to: citizen.job },
        significance: scoreSignificance(EventType.Promotion, [citizen]),
      });
    }

    return events;
  }

  checkUnemploymentSpike(citizens: Citizen[], tickNumber: number): PendingEvent[] {
    const unemployedCount = citizens.filter(c => c.job === JobType.Unemployed).length;
    if (citizens.length === 0) return [];

    const rate = unemployedCount / citizens.length;
    const debounce = 168; // one sim week between spike events

    if (rate >= UNEMPLOYMENT_SPIKE_THRESHOLD && tickNumber - this.lastUnemploymentSpikeTick > debounce) {
      this.lastUnemploymentSpikeTick = tickNumber;
      const eventType = rate >= STRIKE_THRESHOLD ? EventType.Strike : EventType.UnemploymentSpike;
      return [{
        type: eventType,
        occurredAt: tickNumber,
        citizenIds: [],
        data: { rate: Math.round(rate * 100), unemployed: unemployedCount, total: citizens.length },
        significance: scoreSignificance(eventType, []),
      }];
    }

    return [];
  }
}
