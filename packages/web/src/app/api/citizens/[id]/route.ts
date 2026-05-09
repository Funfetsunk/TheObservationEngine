import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import type { CitizenProfileResponse } from '@/types/api';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<CitizenProfileResponse | { error: string }>> {
  const { id } = await context.params;
  const prisma = getPrisma();

  const citizen = await prisma.citizen.findUnique({
    where: { id },
    include: {
      homeDistrict: true,
      relationshipsAsA: { include: { citizenB: true }, orderBy: { score: 'desc' } },
      relationshipsAsB: { include: { citizenA: true }, orderBy: { score: 'desc' } },
    },
  });

  if (!citizen) {
    return NextResponse.json({ error: 'Citizen not found' }, { status: 404 });
  }

  const relationships = [
    ...citizen.relationshipsAsA.map(r => ({
      citizenId: r.citizenBId,
      citizenName: r.citizenB.name,
      score: r.score,
      type: r.type,
      formedAt: tickToISOString(r.formedAt),
    })),
    ...citizen.relationshipsAsB.map(r => ({
      citizenId: r.citizenAId,
      citizenName: r.citizenA.name,
      score: r.score,
      type: r.type,
      formedAt: tickToISOString(r.formedAt),
    })),
  ].sort((a, b) => b.score - a.score);

  const body: CitizenProfileResponse = {
    id: citizen.id,
    name: citizen.name,
    age: citizen.age,
    bornAt: tickToISOString(citizen.bornAt),
    diedAt: citizen.diedAt !== null ? tickToISOString(citizen.diedAt) : null,
    jobType: citizen.jobType,
    biography: citizen.biography,
    traits: {
      ambition: citizen.traitAmbition,
      honesty: citizen.traitHonesty,
      sociability: citizen.traitSociability,
      empathy: citizen.traitEmpathy,
      riskTolerance: citizen.traitRiskTolerance,
      religiosity: citizen.traitReligiosity,
      political: citizen.traitPolitical,
    },
    needs: {
      hunger: citizen.needHunger,
      energy: citizen.needEnergy,
      social: citizen.needSocial,
    },
    currentActivity: citizen.currentAction,
    districtId: citizen.homeDistrictId,
    districtName: citizen.homeDistrict.name,
    relationships,
  };

  return NextResponse.json(body);
}
