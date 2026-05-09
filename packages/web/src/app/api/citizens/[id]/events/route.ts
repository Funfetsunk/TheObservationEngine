import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import type { CitizenEventsResponse } from '@/types/api';

const PAGE_SIZE = 20;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<CitizenEventsResponse | { error: string }>> {
  const { id } = await context.params;
  const prisma = getPrisma();
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10));

  const citizen = await prisma.citizen.findUnique({ where: { id }, select: { id: true } });
  if (!citizen) {
    return NextResponse.json({ error: 'Citizen not found' }, { status: 404 });
  }

  const where = { citizenIds: { has: id } };

  const [rows, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { occurredAt: 'desc' },
      include: { district: true },
    }),
    prisma.event.count({ where }),
  ]);

  const events = rows.map(e => ({
    id: e.id,
    type: e.type,
    occurredAt: tickToISOString(e.occurredAt),
    significance: e.significance,
    districtName: e.district?.name ?? null,
    data: e.data as Record<string, unknown>,
  }));

  return NextResponse.json({ events, total });
}
