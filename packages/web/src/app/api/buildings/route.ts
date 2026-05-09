import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { BuildingsResponse } from '@/types/api';

export async function GET(): Promise<NextResponse<BuildingsResponse>> {
  const prisma = getPrisma();

  const rows = await prisma.building.findMany({
    where: { demolishedAt: null },
    include: { district: { select: { name: true } } },
    orderBy: { builtAt: 'asc' },
  });

  const buildings = rows.map(b => ({
    id: b.id,
    name: b.name,
    type: b.type,
    districtId: b.districtId,
    districtName: b.district.name,
    builtAt: b.builtAt,
    capacity: b.capacity,
  }));

  return NextResponse.json({ buildings });
}
