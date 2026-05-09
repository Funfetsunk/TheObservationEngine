import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const prisma = getPrisma();

  const factions = await prisma.faction.findMany({
    orderBy: { formedAt: 'asc' },
  });

  const allCitizenIds = [...new Set(factions.flatMap(f => [...f.leaderIds, ...f.memberIds]))];
  const citizens = await prisma.citizen.findMany({
    where: { id: { in: allCitizenIds } },
    select: { id: true, name: true },
  });
  const citizenMap = new Map(citizens.map(c => [c.id, c.name]));

  return NextResponse.json({
    factions: factions.map(f => ({
      id: f.id,
      name: f.name,
      formedAt: f.formedAt,
      memberCount: f.memberIds.length,
      leaders: f.leaderIds.map(id => ({ id, name: citizenMap.get(id) ?? 'Unknown' })),
      agenda: f.agenda,
    })),
  });
}
