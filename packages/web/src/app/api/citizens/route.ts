import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import type { CitizensResponse } from '@/types/api';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest): Promise<NextResponse<CitizensResponse>> {
  const prisma = getPrisma();
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10));
  const districtFilter = searchParams.get('district');
  const jobFilter = searchParams.get('job');

  const where = {
    diedAt: null,
    ...(districtFilter ? { homeDistrictId: districtFilter } : {}),
    ...(jobFilter ? { jobType: jobFilter } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.citizen.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      include: { homeDistrict: true },
    }),
    prisma.citizen.count({ where }),
  ]);

  const citizens = rows.map(c => ({
    id: c.id,
    name: c.name,
    age: c.age,
    jobType: c.jobType,
    districtId: c.homeDistrictId,
    districtName: c.homeDistrict.name,
    currentActivity: c.currentAction,
    biography: c.biography,
  }));

  return NextResponse.json({ citizens, total, page });
}
