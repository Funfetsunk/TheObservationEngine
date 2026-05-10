import { PrismaClient } from '@wixbury/db';
import { Citizen, DistrictId, EventType, JobType } from '@wixbury/shared';
import {
  BIRTH_PROBABILITY_PER_TICK,
  CITIZEN_MAX_DEATH_AGE,
  CITIZEN_MIN_DEATH_AGE,
  CRISIS_DEATH_CONSECUTIVE_TICKS,
  MIGRATION_PROBABILITY_PER_TICK,
  MIN_WORKING_AGE,
  NEEDS_CRISIS_THRESHOLD,
  TICKS_PER_SIM_YEAR,
} from './constants';
import { PendingEvent } from './event-emitter';
import { scoreSignificance } from './significance-scorer';
import { syncCitizenAge } from './db-sync';
import { createCitizen } from './citizen-agent';
import type { RelationshipEngine } from './relationship-engine';

function inheritTrait(parentA: number, parentB: number): number {
  const base = (parentA + parentB) / 2;
  const noise = (Math.random() - 0.5) * 0.3;
  return Math.max(0, Math.min(1, base + noise));
}

async function insertCitizenToDb(citizen: Citizen, bornAt: number, prisma: PrismaClient): Promise<void> {
  await prisma.citizen.create({
    data: {
      id: citizen.id,
      name: citizen.name,
      age: citizen.age,
      bornAt,
      homeDistrictId: citizen.homeDistrictId,
      jobType: citizen.job,
      traitAmbition: citizen.traits.ambition,
      traitHonesty: citizen.traits.honesty,
      traitSociability: citizen.traits.sociability,
      traitEmpathy: citizen.traits.empathy,
      traitRiskTolerance: citizen.traits.riskTolerance,
      traitReligiosity: citizen.traits.religiosity,
      traitPolitical: citizen.traits.political,
      needHunger: citizen.needs.hunger,
      needEnergy: citizen.needs.energy,
      needSocial: citizen.needs.social,
      currentAction: citizen.currentAction,
      currentLocationId: citizen.currentLocationId,
      workedTodayTicks: 0,
      parentAId: citizen.parentAId,
      parentBId: citizen.parentBId,
    },
  });
}

export class PopulationEngine {
  private readonly crisisStreaks = new Map<string, number>();

  async tickAgeing(citizens: Citizen[], tickNumber: number, prisma: PrismaClient): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    for (const citizen of citizens) {
      citizen.age++;
      if (citizen.age === MIN_WORKING_AGE) {
        citizen.job = JobType.Unemployed;
        citizen.dailyWorkTarget = 0;
        await prisma.citizen.update({
          where: { id: citizen.id },
          data: { jobType: JobType.Unemployed },
        });
        events.push({
          type: EventType.CitizenGraduated,
          occurredAt: tickNumber,
          citizenIds: [citizen.id],
          data: { citizenName: citizen.name, age: citizen.age },
          significance: scoreSignificance(EventType.CitizenGraduated, [citizen]),
        });
      }
    }
    await Promise.all(citizens.map(c => syncCitizenAge(c.id, c.age, prisma)));
    return events;
  }

  checkNaturalDeaths(citizens: readonly Citizen[], tickNumber: number): PendingEvent[] {
    const events: PendingEvent[] = [];
    for (const citizen of citizens) {
      if (citizen.age < CITIZEN_MIN_DEATH_AGE) continue;
      const ageRatio = Math.min(
        1,
        (citizen.age - CITIZEN_MIN_DEATH_AGE) / (CITIZEN_MAX_DEATH_AGE - CITIZEN_MIN_DEATH_AGE),
      );
      // Per-tick probability: annual probability scaled to per-tick
      // At MAX_DEATH_AGE: ~100% chance of dying within a simulated year
      const deathProbPerTick = ageRatio / TICKS_PER_SIM_YEAR;
      if (Math.random() < deathProbPerTick) {
        events.push({
          type: EventType.CitizenDied,
          occurredAt: tickNumber,
          citizenIds: [citizen.id],
          data: { citizenName: citizen.name, age: citizen.age, cause: 'natural' },
          significance: scoreSignificance(EventType.CitizenDied, [citizen as Citizen]),
        });
      }
    }
    return events;
  }

  checkCrisisDeaths(citizens: readonly Citizen[], tickNumber: number): PendingEvent[] {
    const events: PendingEvent[] = [];
    for (const citizen of citizens) {
      const allInCrisis =
        citizen.needs.hunger < NEEDS_CRISIS_THRESHOLD &&
        citizen.needs.energy < NEEDS_CRISIS_THRESHOLD &&
        citizen.needs.social < NEEDS_CRISIS_THRESHOLD;

      if (allInCrisis) {
        const streak = (this.crisisStreaks.get(citizen.id) ?? 0) + 1;
        this.crisisStreaks.set(citizen.id, streak);
        if (streak >= CRISIS_DEATH_CONSECUTIVE_TICKS) {
          events.push({
            type: EventType.CitizenDied,
            occurredAt: tickNumber,
            citizenIds: [citizen.id],
            data: { citizenName: citizen.name, age: citizen.age, cause: 'needs_crisis' },
            significance: scoreSignificance(EventType.CitizenDied, [citizen as Citizen]),
          });
        }
      } else {
        this.crisisStreaks.delete(citizen.id);
      }
    }
    return events;
  }

  async killCitizen(
    citizen: Citizen,
    citizens: Citizen[],
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<void> {
    await prisma.citizen.update({
      where: { id: citizen.id },
      data: { diedAt: tickNumber },
    });
    const idx = citizens.indexOf(citizen);
    if (idx !== -1) citizens.splice(idx, 1);
    this.crisisStreaks.delete(citizen.id);
  }

  async checkBirths(
    citizens: Citizen[],
    relationships: RelationshipEngine,
    tickNumber: number,
    prisma: PrismaClient,
  ): Promise<PendingEvent[]> {
    const events: PendingEvent[] = [];
    const citizenMap = new Map(citizens.map(c => [c.id, c]));

    for (const [aId, bId] of relationships.getRomanticPairs()) {
      const parentA = citizenMap.get(aId);
      const parentB = citizenMap.get(bId);
      if (!parentA || !parentB) continue;
      if (parentA.age > 45 || parentB.age > 45) continue;
      if (Math.random() >= BIRTH_PROBABILITY_PER_TICK) continue;

      const newborn = createCitizen(parentA.homeDistrictId as DistrictId, JobType.Unemployed);
      newborn.age = 0;
      newborn.dailyWorkTarget = 0;
      newborn.parentAId = aId;
      newborn.parentBId = bId;
      newborn.traits = {
        ambition: inheritTrait(parentA.traits.ambition, parentB.traits.ambition),
        honesty: inheritTrait(parentA.traits.honesty, parentB.traits.honesty),
        sociability: inheritTrait(parentA.traits.sociability, parentB.traits.sociability),
        empathy: inheritTrait(parentA.traits.empathy, parentB.traits.empathy),
        riskTolerance: inheritTrait(parentA.traits.riskTolerance, parentB.traits.riskTolerance),
        religiosity: inheritTrait(parentA.traits.religiosity, parentB.traits.religiosity),
        political: inheritTrait(parentA.traits.political, parentB.traits.political),
      };

      await insertCitizenToDb(newborn, tickNumber, prisma);
      citizens.push(newborn);

      events.push({
        type: EventType.CitizenBorn,
        occurredAt: tickNumber,
        citizenIds: [newborn.id, aId, bId],
        data: {
          citizenName: newborn.name,
          parentAName: parentA.name,
          parentBName: parentB.name,
        },
        significance: scoreSignificance(EventType.CitizenBorn, [newborn]),
      });
    }

    return events;
  }

  async checkMigration(citizens: Citizen[], tickNumber: number, prisma: PrismaClient): Promise<PendingEvent[]> {
    if (Math.random() >= MIGRATION_PROBABILITY_PER_TICK) return [];

    const districts = Object.values(DistrictId) as DistrictId[];
    const district = districts[Math.floor(Math.random() * districts.length)];
    const migrant = createCitizen(district);

    await insertCitizenToDb(migrant, tickNumber, prisma);
    citizens.push(migrant);

    return [{
      type: EventType.CitizenMigrated,
      occurredAt: tickNumber,
      citizenIds: [migrant.id],
      data: { citizenName: migrant.name, districtId: district, age: migrant.age, job: migrant.job },
      significance: scoreSignificance(EventType.CitizenMigrated, [migrant]),
    }];
  }
}
