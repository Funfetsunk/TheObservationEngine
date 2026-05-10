import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { PrismaClient } from '@wixbury/db';
import { Building, Citizen, EventType, JobType } from '@wixbury/shared';
import { tickCitizen, feedChildren } from './citizen-agent';
import { RelationshipEngine } from './relationship-engine';
import { PopulationEngine } from './population-engine';
import { EconomyEngine } from './economy-engine';
import { PoliticalEngine, PoliticalFaction } from './political-engine';
import { DistrictEngine, RuntimeDistrict } from './district-engine';
import { emitEvents, PendingEvent } from './event-emitter';
import { syncCitizensToDb, saveTickState } from './db-sync';
import { scoreSignificance } from './significance-scorer';
import { publishTick, publishSignificantEvents } from './tick-publisher';
import {
  TICK_INTERVAL_MS,
  TICKS_PER_SIM_DAY,
  TICKS_PER_SIM_WEEK,
  TICKS_PER_SIM_MONTH,
  TICKS_PER_SIM_YEAR,
  ELECTION_INTERVAL_TICKS,
  JOB_CHANGE_CHECK_INTERVAL_TICKS,
  NEEDS_CRISIS_THRESHOLD,
  SIM_DAYS_TO_RUN,
  NEWSPAPER_EDITION_INTERVAL_TICKS,
} from './constants';
import type { NewspaperEditionJobData, HistoricalSummaryJobData } from './queue';

function collectCrisisEvents(citizens: Citizen[], tick: number): PendingEvent[] {
  const events: PendingEvent[] = [];
  for (const c of citizens) {
    const needEntries = Object.entries(c.needs) as [keyof typeof c.needs, number][];
    for (const [need, value] of needEntries) {
      if (value < NEEDS_CRISIS_THRESHOLD) {
        events.push({
          type: EventType.NeedsCrisis,
          occurredAt: tick,
          citizenIds: [c.id],
          data: { citizenName: c.name, need, value },
          significance: scoreSignificance(EventType.NeedsCrisis, [c]),
        });
      }
    }
  }
  return events;
}

export function startTickEngine(
  citizens: Citizen[],
  relationships: RelationshipEngine,
  prisma: PrismaClient,
  redis: Redis,
  queue: Queue,
  initialTickNumber: number,
  populationEngine: PopulationEngine,
  economyEngine: EconomyEngine,
  businesses: import('@wixbury/shared').Business[],
  politicalEngine: PoliticalEngine,
  factions: PoliticalFaction[],
  districtEngine: DistrictEngine,
  districts: RuntimeDistrict[],
  buildings: Building[],
): void {
  let tickNumber = initialTickNumber;
  let tickInProgress = false;

  const interval = setInterval(() => {
    if (tickInProgress) return;
    tickInProgress = true;
    void (async () => {
      tickNumber++;
      try {
        for (const citizen of citizens) {
          tickCitizen(citizen, tickNumber);
        }

        feedChildren(citizens);

        economyEngine.tickWages(citizens);

        const crisisEvents = collectCrisisEvents(citizens, tickNumber);
        const relEvents = relationships.processColocations(citizens, tickNumber);

        await syncCitizensToDb(citizens, prisma);
        await relationships.syncDirty(prisma);

        const ageingEvents: PendingEvent[] = [];
        if (tickNumber % TICKS_PER_SIM_YEAR === 0 && tickNumber > 0) {
          ageingEvents.push(...await populationEngine.tickAgeing(citizens, tickNumber, prisma));
        }

        const naturalDeaths = populationEngine.checkNaturalDeaths(citizens, tickNumber);
        const crisisDeaths = populationEngine.checkCrisisDeaths(citizens, tickNumber);
        const birthEvents = await populationEngine.checkBirths(citizens, relationships, tickNumber, prisma);
        const migrationEvents = await populationEngine.checkMigration(citizens, tickNumber, prisma);

        // Deduplicate deaths — one event per citizen if both natural + crisis fire
        const deathById = new Map<string, PendingEvent>();
        for (const ev of [...naturalDeaths, ...crisisDeaths]) {
          if (!deathById.has(ev.citizenIds[0])) deathById.set(ev.citizenIds[0], ev);
        }
        const deathEvents: PendingEvent[] = [];
        for (const [citizenId, ev] of deathById) {
          const dying = citizens.find(c => c.id === citizenId);
          if (dying) {
            deathEvents.push(ev);
            await populationEngine.killCitizen(dying, citizens, tickNumber, prisma);
          }
        }

        const economyEvents: PendingEvent[] = [];
        economyEvents.push(...economyEngine.checkUnemploymentSpike(citizens, tickNumber));

        if (tickNumber % TICKS_PER_SIM_WEEK === 0) {
          economyEvents.push(...await economyEngine.checkBusinessOpportunities(citizens, businesses, tickNumber, prisma));
          economyEvents.push(...await economyEngine.checkBusinessFailures(citizens, businesses, tickNumber, prisma));
        }

        if (tickNumber % JOB_CHANGE_CHECK_INTERVAL_TICKS === 0) {
          economyEvents.push(...await economyEngine.checkJobChanges(citizens, tickNumber, prisma));
        }

        const politicalEvents: PendingEvent[] = [];
        const councillors = citizens.filter(c => c.job === JobType.Councillor);

        if (tickNumber % TICKS_PER_SIM_WEEK === 0) {
          politicalEvents.push(...await politicalEngine.checkFactionFormation(citizens, factions, tickNumber, prisma));
          politicalEvents.push(...politicalEngine.checkCorruption(councillors, tickNumber));
        }

        if (tickNumber % TICKS_PER_SIM_MONTH === 0) {
          politicalEvents.push(...await politicalEngine.proposePolicy(councillors, tickNumber, prisma));
        }

        if (tickNumber % ELECTION_INTERVAL_TICKS === 0 && tickNumber > 0) {
          politicalEvents.push(...await politicalEngine.runElection(citizens, relationships, tickNumber, prisma));
        }

        const districtEvents: PendingEvent[] = [];
        if (tickNumber % TICKS_PER_SIM_YEAR === 0 && tickNumber > 0) {
          districtEvents.push(...await districtEngine.tickWealthDrift(districts, citizens, tickNumber, prisma));
          districtEvents.push(...await districtEngine.checkConstruction(districts, citizens, buildings, tickNumber, prisma));
          districtEvents.push(...await districtEngine.checkDemolition(buildings, tickNumber, prisma));

          const simYear = Math.floor(tickNumber / TICKS_PER_SIM_YEAR);
          const yearStart = tickNumber - TICKS_PER_SIM_YEAR + 1;
          const historicalJobData: HistoricalSummaryJobData = {
            yearStart,
            yearEnd: tickNumber,
            simYear,
          };
          await queue.add('generate_historical_summary', historicalJobData, {
            jobId: `year-${simYear}`,
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 5 },
          });
        }

        const allEvents: PendingEvent[] = [
          ...crisisEvents,
          ...relEvents,
          ...ageingEvents,
          ...deathEvents,
          ...birthEvents,
          ...migrationEvents,
          ...economyEvents,
          ...politicalEvents,
          ...districtEvents,
        ];

        await emitEvents(allEvents, prisma);
        await saveTickState(redis, tickNumber);

        const citizenMap = new Map(citizens.map(c => [c.id, c.name]));
        await publishTick(redis, tickNumber, citizens);
        await publishSignificantEvents(redis, allEvents, citizenMap);

        if (tickNumber % NEWSPAPER_EDITION_INTERVAL_TICKS === 0) {
          const editionNumber = Math.floor(tickNumber / NEWSPAPER_EDITION_INTERVAL_TICKS);
          const weekStart = tickNumber - NEWSPAPER_EDITION_INTERVAL_TICKS + 1;
          const jobData: NewspaperEditionJobData = {
            weekStart,
            weekEnd: tickNumber,
            currentTick: tickNumber,
          };
          await queue.add('generate_newspaper_edition', jobData, {
            jobId: `edition-${editionNumber}`,
            removeOnComplete: { count: 10 },
            removeOnFail: { count: 5 },
          });
        }

        if (tickNumber % TICKS_PER_SIM_DAY === 0) {
          const day = Math.floor(tickNumber / TICKS_PER_SIM_DAY);
          for (const c of citizens) c.workedTodayTicks = 0;
          console.log(JSON.stringify({
            event: 'day_complete',
            day,
            tick: tickNumber,
            population: citizens.length,
            relationships: relationships.getCount(),
            events: allEvents.length,
          }));

          if (SIM_DAYS_TO_RUN > 0 && day >= SIM_DAYS_TO_RUN) {
            console.log(JSON.stringify({ event: 'sim_complete', days: day }));
            clearInterval(interval);
            process.exit(0);
          }
        }
      } catch (err) {
        console.error(JSON.stringify({
          event: 'tick_error',
          tick: tickNumber,
          error: err instanceof Error ? err.message : String(err),
        }));
      } finally {
        tickInProgress = false;
      }
    })();
  }, TICK_INTERVAL_MS);

  process.on('SIGTERM', () => { clearInterval(interval); process.exit(0); });
  process.on('SIGINT', () => { clearInterval(interval); process.exit(0); });
}
