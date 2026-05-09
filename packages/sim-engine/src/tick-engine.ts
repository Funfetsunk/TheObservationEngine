import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { PrismaClient } from '@wixbury/db';
import { Citizen, EventType } from '@wixbury/shared';
import { tickCitizen } from './citizen-agent';
import { RelationshipEngine } from './relationship-engine';
import { emitEvents, PendingEvent } from './event-emitter';
import { syncCitizensToDb, saveTickState } from './db-sync';
import { scoreSignificance } from './significance-scorer';
import { publishTick, publishSignificantEvents } from './tick-publisher';
import {
  TICK_INTERVAL_MS,
  TICKS_PER_SIM_DAY,
  NEEDS_CRISIS_THRESHOLD,
  SIM_DAYS_TO_RUN,
  NEWSPAPER_EDITION_INTERVAL_TICKS,
} from './constants';
import type { NewspaperEditionJobData } from './queue';

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
          tickCitizen(citizen);
        }

        const crisisEvents = collectCrisisEvents(citizens, tickNumber);
        const relEvents = relationships.processColocations(citizens, tickNumber);
        const allEvents: PendingEvent[] = [...crisisEvents, ...relEvents];

        await syncCitizensToDb(citizens, prisma);
        await relationships.syncDirty(prisma);
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
            citizens: citizens.length,
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
