import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import type { NewspaperEditionResponse } from '@/types/api';

const TICKS_PER_EDITION = 168;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<NewspaperEditionResponse | { error: string }>> {
  const { id } = await context.params;
  const prisma = getPrisma();

  const edition = await prisma.newspaperEdition.findUnique({ where: { id } });
  if (!edition) {
    return NextResponse.json({ error: 'Edition not found' }, { status: 404 });
  }

  const eventsCount = await prisma.event.count({
    where: {
      occurredAt: { gte: edition.weekStart, lte: edition.weekEnd },
      significance: { gte: 0.6 },
    },
  });

  const body: NewspaperEditionResponse = {
    id: edition.id,
    editionNumber: Math.floor(edition.editionAt / TICKS_PER_EDITION),
    publishedAt: tickToISOString(edition.editionAt),
    content: edition.content,
    eventsCount,
  };

  return NextResponse.json(body);
}
