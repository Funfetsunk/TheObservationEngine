import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { DistrictDetailResponse } from '@/types/api';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: Params): Promise<NextResponse> {
  const { id } = await params;
  const prisma = getPrisma();

  const district = await prisma.district.findUnique({
    where: { id },
    include: {
      _count: { select: { citizens: { where: { diedAt: null } } } },
      buildings: { where: { demolishedAt: null }, orderBy: { builtAt: 'asc' } },
    },
  });

  if (!district) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const response: DistrictDetailResponse = {
    id: district.id,
    name: district.name,
    character: district.character,
    wealthScore: district.wealthScore,
    populationScore: district.populationScore,
    citizenCount: district._count.citizens,
    buildings: district.buildings.map(b => ({
      id: b.id,
      name: b.name,
      type: b.type,
      districtId: b.districtId,
      districtName: district.name,
      builtAt: b.builtAt,
      capacity: b.capacity,
    })),
  };

  return NextResponse.json(response);
}
