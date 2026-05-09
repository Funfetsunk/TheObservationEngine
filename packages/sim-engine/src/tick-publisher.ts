import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { Citizen } from '@wixbury/shared';
import { SIGNIFICANCE_THRESHOLD, NEWSPAPER_EDITION_INTERVAL_TICKS } from './constants';
import type { PendingEvent } from './event-emitter';

const FOUNDING_EPOCH_MS = new Date('1991-01-01T00:00:00Z').getTime();
const MS_PER_SIM_HOUR = 60 * 60 * 1000;

function tickToISO(tick: number): string {
  return new Date(FOUNDING_EPOCH_MS + tick * MS_PER_SIM_HOUR).toISOString();
}

function getDistrictPosition(citizenId: string): { x: number; y: number } {
  const hash = citizenId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    x: (hash % 100) / 100,
    y: (Math.floor(hash / 100) % 100) / 100,
  };
}

export interface TickMessage {
  type: 'tick';
  tick: number;
  simulatedAt: string;
  citizens: {
    id: string;
    name: string;
    districtId: string;
    activity: string;
    positionX: number;
    positionY: number;
  }[];
}

export interface EventMessage {
  type: 'event';
  eventId: string;
  eventType: string;
  significance: number;
  districtId: string | null;
  citizenIds: string[];
  citizenNames: string[];
}

export interface EditionMessage {
  type: 'edition';
  editionId: string;
  editionNumber: number;
  publishedAt: string;
}

export async function publishTick(redis: Redis, tick: number, citizens: Citizen[]): Promise<void> {
  const message: TickMessage = {
    type: 'tick',
    tick,
    simulatedAt: tickToISO(tick),
    citizens: citizens.map(c => {
      const pos = getDistrictPosition(c.id);
      return {
        id: c.id,
        name: c.name,
        districtId: c.homeDistrictId,
        activity: c.currentAction,
        positionX: pos.x,
        positionY: pos.y,
      };
    }),
  };
  await redis.publish('wixbury:tick', JSON.stringify(message));
}

export async function publishSignificantEvents(
  redis: Redis,
  events: PendingEvent[],
  citizenMap: Map<string, string>,
): Promise<void> {
  const significant = events.filter(e => e.significance >= SIGNIFICANCE_THRESHOLD);
  for (const e of significant) {
    const message: EventMessage = {
      type: 'event',
      eventId: randomUUID(),
      eventType: e.type,
      significance: e.significance,
      districtId: e.districtId ?? null,
      citizenIds: e.citizenIds,
      citizenNames: e.citizenIds.map(id => citizenMap.get(id) ?? id),
    };
    await redis.publish('wixbury:event', JSON.stringify(message));
  }
}

export async function publishEdition(
  redis: Redis,
  editionId: string,
  editionAt: number,
): Promise<void> {
  const message: EditionMessage = {
    type: 'edition',
    editionId,
    editionNumber: Math.floor(editionAt / NEWSPAPER_EDITION_INTERVAL_TICKS),
    publishedAt: tickToISO(editionAt),
  };
  await redis.publish('wixbury:edition', JSON.stringify(message));
}
