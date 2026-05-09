import { Redis } from 'ioredis';
import { PrismaClient } from '@wixbury/db';
import { Citizen } from '@wixbury/shared';

const TICK_STATE_KEY = 'wixbury:tick:state';

export interface TickState {
  tickNumber: number;
}

export async function loadTickState(redis: Redis): Promise<TickState> {
  const raw = await redis.get(TICK_STATE_KEY);
  if (!raw) return { tickNumber: 0 };
  return JSON.parse(raw) as TickState;
}

export async function saveTickState(redis: Redis, tickNumber: number): Promise<void> {
  await redis.set(TICK_STATE_KEY, JSON.stringify({ tickNumber }));
}

export async function syncCitizensToDb(citizens: Citizen[], prisma: PrismaClient): Promise<void> {
  await Promise.all(
    citizens.map(c =>
      prisma.citizen.update({
        where: { id: c.id },
        data: {
          needHunger: c.needs.hunger,
          needEnergy: c.needs.energy,
          needSocial: c.needs.social,
          currentAction: c.currentAction,
          currentLocationId: c.currentLocationId,
          workedTodayTicks: c.workedTodayTicks,
        },
      }),
    ),
  );
}
