import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

interface BusinessSummary {
  id: string;
  name: string;
  type: string;
  districtId: string;
  districtName: string;
  ownerId: string | null;
  openedAt: number;
  employeeCount: number;
}

interface BusinessesResponse {
  businesses: BusinessSummary[];
}

export async function GET(_request: NextRequest): Promise<NextResponse<BusinessesResponse>> {
  const prisma = getPrisma();

  const rows = await prisma.business.findMany({
    where: { closedAt: null },
    include: { district: true },
    orderBy: { openedAt: 'asc' },
  });

  const businesses = rows.map(b => ({
    id: b.id,
    name: b.name,
    type: b.type,
    districtId: b.districtId,
    districtName: b.district.name,
    ownerId: b.ownerId,
    openedAt: b.openedAt,
    employeeCount: b.employeeIds.length,
  }));

  return NextResponse.json({ businesses });
}
