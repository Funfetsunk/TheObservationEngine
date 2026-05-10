import { PrismaClient } from '@wixbury/db';
import { Business, BusinessType, Citizen, CitizenAction, EventType, JobType } from '@wixbury/shared';
import {
  BUSINESS_CAPACITY,
  BUSINESS_INSOLVENCY_THRESHOLD,
  BUSINESS_OPEN_PROBABILITY_PER_WEEK,
  BUSINESS_OPEN_WEALTH_THRESHOLD,
  BUSINESS_OPERATING_COST_PER_WEEK,
  BUSINESS_SALE_PRICE,
  JOB_CHANGE_WEALTH_THRESHOLD,
  JOB_PROMOTION_PROBABILITY,
  JOB_SEEK_PROBABILITY,
  MAX_WORK_HOURS,
  MIN_WORK_HOURS,
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

const EMPLOYEE_JOB_TYPE: Partial<Record<BusinessType, JobType>> = {
  [BusinessType.Pub]: JobType.Publican,
  [BusinessType.Shop]: JobType.Shopkeeper,
  [BusinessType.Factory]: JobType.FactoryWorker,
  [BusinessType.Clinic]: JobType.Doctor,
  [BusinessType.School]: JobType.Teacher,
  [BusinessType.Church]: JobType.Clergy,
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

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickBusinessName(type: BusinessType): string {
  return randFrom(BUSINESS_NAMES[type]);
}

function workHoursForCitizen(citizen: Citizen): number {
  return Math.round(MIN_WORK_HOURS + citizen.traits.ambition * (MAX_WORK_HOURS - MIN_WORK_HOURS));
}

function displaceEmployees(business: Business, citizenMap: Map<string, Citizen>): Citizen[] {
  const displaced: Citizen[] = [];
  for (const empId of business.employeeIds) {
    const emp = citizenMap.get(empId);
    if (emp) {
      emp.job = JobType.Unemployed;
      emp.dailyWorkTarget = 0;
      displaced.push(emp);
    }
  }
  business.employeeIds = [];
  return displaced;
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

  checkBusinessCosts(citizens: Citizen[], businesses: Business[]): void {
    const citizenMap = new Map(citizens.map(c => [c.id, c]));
    for (const business of businesses) {
      if (business.closedAt !== null || business.ownerId === null) continue;
      const owner = citizenMap.get(business.ownerId);
      if (!owner) continue;
      const cost = BUSINESS_OPERATING_COST_PER_WEEK[business.type] ?? 0;
      owner.wealth = Math.max(0, owner.wealth - cost);
    }
  }

  async checkInsolventBusinesses(
    citizens: Citizen[],
    businesses: Business[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const citizenMap = new Map(citizens.map(c => [c.id, c]));
    const openOwnerIds = new Set(
      businesses.filter(b => b.closedAt === null && b.ownerId !== null).map(b => b.ownerId!),
    );

    for (const business of businesses) {
      if (business.closedAt !== null || business.ownerId === null) continue;
      const owner = citizenMap.get(business.ownerId);
      if (!owner) continue;
      if (owner.wealth >= BUSINESS_INSOLVENCY_THRESHOLD) continue;

      // Try to find a buyer
      const buyer = citizens.find(c =>
        c.id !== owner.id &&
        !openOwnerIds.has(c.id) &&
        c.age >= MIN_WORKING_AGE &&
        c.wealth >= BUSINESS_OPEN_WEALTH_THRESHOLD + BUSINESS_SALE_PRICE &&
        c.traits.ambition > 0.55,
      );

      if (buyer) {
        buyer.wealth -= BUSINESS_SALE_PRICE;
        owner.wealth += Math.floor(BUSINESS_SALE_PRICE * 0.5);
        openOwnerIds.delete(owner.id);
        openOwnerIds.add(buyer.id);
        business.ownerId = buyer.id;
        await syncBusinessToDb(business, prisma);
        await prisma.citizen.update({ where: { id: buyer.id }, data: { wealth: buyer.wealth } });

        events.push({
          type: EventType.BusinessSold,
          occurredAt: tickNumber,
          citizenIds: [owner.id, buyer.id],
          data: {
            businessName: business.name,
            businessType: business.type,
            sellerName: owner.name,
            buyerName: buyer.name,
          },
          significance: scoreSignificance(EventType.BusinessSold, [owner, buyer]),
        });
      } else {
        // No buyer — close the business
        business.closedAt = tickNumber;
        const displaced = displaceEmployees(business, citizenMap);
        await syncBusinessToDb(business, prisma);

        const involvedCitizens = displaced.length > 0 ? displaced : [owner];
        events.push({
          type: EventType.BusinessClosed,
          occurredAt: tickNumber,
          citizenIds: [owner.id, ...displaced.map(c => c.id)],
          data: { businessName: business.name, businessType: business.type, displaced: displaced.length },
          significance: scoreSignificance(EventType.BusinessClosed, involvedCitizens),
        });

        const avgHonesty =
          displaced.length > 0
            ? displaced.reduce((sum, c) => sum + c.traits.honesty, 0) / displaced.length
            : 1;

        if (displaced.length > 1 && avgHonesty < 0.4 && Math.random() < 0.20) {
          events.push({
            type: EventType.Strike,
            occurredAt: tickNumber,
            citizenIds: displaced.map(c => c.id),
            data: { businessName: business.name, workers: displaced.length },
            significance: scoreSignificance(EventType.Strike, displaced),
          });
        }
      }
    }

    return events;
  }

  async checkHiring(
    citizens: Citizen[],
    businesses: Business[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<void> {
    const unemployedAdults = shuffle(
      citizens.filter(c => c.job === JobType.Unemployed && c.age >= MIN_WORKING_AGE),
    );
    if (unemployedAdults.length === 0) return;

    const unemployedPool = new Set(unemployedAdults.map(c => c.id));

    for (const business of businesses) {
      if (business.closedAt !== null) continue;
      const capacity = BUSINESS_CAPACITY[business.type] ?? 1;
      const vacancies = capacity - business.employeeIds.length;
      if (vacancies <= 0) continue;

      const jobType = EMPLOYEE_JOB_TYPE[business.type as BusinessType];
      if (!jobType) continue;

      const hired: Citizen[] = [];
      for (const candidate of unemployedAdults) {
        if (hired.length >= vacancies) break;
        if (!unemployedPool.has(candidate.id)) continue;

        candidate.job = jobType;
        candidate.dailyWorkTarget = workHoursForCitizen(candidate);
        business.employeeIds.push(candidate.id);
        unemployedPool.delete(candidate.id);
        hired.push(candidate);
      }

      if (hired.length > 0) {
        await syncBusinessToDb(business, prisma);
        await Promise.all(
          hired.map(c => prisma.citizen.update({ where: { id: c.id }, data: { jobType: c.job } })),
        );
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
      openBusinessOwners.add(citizen.id);

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
          citizen.dailyWorkTarget = workHoursForCitizen(citizen);
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
      citizen.dailyWorkTarget = workHoursForCitizen(citizen);
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
    const adults = citizens.filter(c => c.age >= MIN_WORKING_AGE);
    if (adults.length === 0) return [];

    const unemployedCount = adults.filter(c => c.job === JobType.Unemployed).length;
    const rate = unemployedCount / adults.length;
    const debounce = 168;

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
