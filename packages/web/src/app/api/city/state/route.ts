import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { tickToISOString } from '@/lib/simulated-time';
import type { CityStateResponse } from '@/types/api';

interface TickState {
  tickNumber: number;
}

const TICKS_PER_DAY = 24;

export async function GET(): Promise<NextResponse<CityStateResponse>> {
  const prisma = getPrisma();

  let tick = 0;
  try {
    const redis = getRedisClient();
    const raw = await redis.get('wixbury:tick:state');
    if (raw) {
      const state = JSON.parse(raw) as TickState;
      tick = state.tickNumber;
    }
  } catch {
    // sim engine not running — tick stays 0
  }

  const todayStart = Math.floor(tick / TICKS_PER_DAY) * TICKS_PER_DAY;

  const [citizenCount, livingCount, eventsFiredToday] = await Promise.all([
    prisma.citizen.count(),
    prisma.citizen.count({ where: { diedAt: null } }),
    prisma.event.count({
      where: { occurredAt: { gte: todayStart } },
    }),
  ]);

  const body: CityStateResponse = {
    tick,
    simulatedAt: tickToISOString(tick),
    citizenCount,
    livingCount,
    eventsFiredToday,
  };

  return NextResponse.json(body);
}
