import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const prisma = getPrisma();

  const policies = await prisma.policy.findMany({
    orderBy: { passedAt: 'desc' },
  });

  const proposerIds = [...new Set(policies.map(p => p.proposedBy))];
  const proposers = await prisma.citizen.findMany({
    where: { id: { in: proposerIds } },
    select: { id: true, name: true },
  });
  const proposerMap = new Map(proposers.map(p => [p.id, p.name]));

  return NextResponse.json({
    policies: policies.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      proposedBy: p.proposedBy,
      proposerName: proposerMap.get(p.proposedBy) ?? 'Unknown',
      passedAt: p.passedAt,
      effect: p.effect,
      active: p.active,
    })),
  });
}
