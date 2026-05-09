import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import type { EventsResponse } from '@/types/api';

const SIGNIFICANCE_THRESHOLD = 0.6;

export async function GET(request: NextRequest): Promise<NextResponse<EventsResponse>> {
  const prisma = getPrisma();
  const { searchParams } = request.nextUrl;

  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const since = searchParams.get('since');

  const where = {
    significance: { gte: SIGNIFICANCE_THRESHOLD },
    ...(since ? { occurredAt: { gt: parseInt(since, 10) } } : {}),
  };

  const rows = await prisma.event.findMany({
    where,
    take: limit,
    orderBy: { occurredAt: 'desc' },
    include: { district: true },
  });

  // resolve citizenIds to names in a single batched query
  const allCitizenIds = [...new Set(rows.flatMap(e => e.citizenIds))];
  const citizenMap = new Map<string, string>();

  if (allCitizenIds.length > 0) {
    const citizens = await prisma.citizen.findMany({
      where: { id: { in: allCitizenIds } },
      select: { id: true, name: true },
    });
    for (const c of citizens) citizenMap.set(c.id, c.name);
  }

  const events = rows.map(e => ({
    id: e.id,
    type: e.type,
    occurredAt: tickToISOString(e.occurredAt),
    significance: e.significance,
    citizenNames: e.citizenIds.map(cid => citizenMap.get(cid) ?? cid),
    districtName: e.district?.name ?? null,
    data: e.data as Record<string, unknown>,
  }));

  return NextResponse.json({ events });
}
