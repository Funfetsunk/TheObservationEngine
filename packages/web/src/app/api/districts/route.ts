import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { DistrictsResponse } from '@/types/api';

export async function GET(): Promise<NextResponse<DistrictsResponse>> {
  const prisma = getPrisma();

  const rows = await prisma.district.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { citizens: { where: { diedAt: null } } } } },
  });

  const districts = rows.map(d => ({
    id: d.id,
    name: d.name,
    character: d.character,
    citizenCount: d._count.citizens,
    wealthScore: d.wealthScore,
  }));

  return NextResponse.json({ districts });
}
