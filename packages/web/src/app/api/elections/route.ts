import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const prisma = getPrisma();

  const elections = await prisma.election.findMany({
    orderBy: { heldAt: 'desc' },
    take: 20,
  });

  const winnerIds = [...new Set(elections.map(e => e.winnerId))];
  const winners = await prisma.citizen.findMany({
    where: { id: { in: winnerIds } },
    select: { id: true, name: true },
  });
  const winnerMap = new Map(winners.map(w => [w.id, w.name]));

  return NextResponse.json({
    elections: elections.map(e => ({
      id: e.id,
      heldAt: e.heldAt,
      candidateCount: e.candidateIds.length,
      winnerId: e.winnerId,
      winnerName: winnerMap.get(e.winnerId) ?? 'Unknown',
      voteData: e.voteData,
    })),
  });
}
