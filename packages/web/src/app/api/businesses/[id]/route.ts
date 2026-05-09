import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

interface CitizenStub {
  id: string;
  name: string;
  jobType: string;
}

interface BusinessDetail {
  id: string;
  name: string;
  type: string;
  districtId: string;
  districtName: string;
  openedAt: number;
  closedAt: number | null;
  owner: CitizenStub | null;
  employees: CitizenStub[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse<BusinessDetail | { error: string }>> {
  const prisma = getPrisma();

  const business = await prisma.business.findUnique({
    where: { id: params.id },
    include: { district: true },
  });

  if (!business) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [owner, employees] = await Promise.all([
    business.ownerId
      ? prisma.citizen.findUnique({
          where: { id: business.ownerId },
          select: { id: true, name: true, jobType: true },
        })
      : null,
    business.employeeIds.length > 0
      ? prisma.citizen.findMany({
          where: { id: { in: business.employeeIds } },
          select: { id: true, name: true, jobType: true },
        })
      : [],
  ]);

  return NextResponse.json({
    id: business.id,
    name: business.name,
    type: business.type,
    districtId: business.districtId,
    districtName: business.district.name,
    openedAt: business.openedAt,
    closedAt: business.closedAt,
    owner: owner ? { id: owner.id, name: owner.name, jobType: owner.jobType } : null,
    employees: employees.map(e => ({ id: e.id, name: e.name, jobType: e.jobType })),
  });
}
