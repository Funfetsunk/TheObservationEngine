import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import type { NewspaperIndexResponse } from '@/types/api';

const PAGE_SIZE = 10;
const TICKS_PER_EDITION = 168;

function extractHeadline(content: string): string {
  return content.split('\n').find(l => l.trim().length > 0)?.trim() ?? 'The Wixbury Gazette';
}

export async function GET(request: NextRequest): Promise<NextResponse<NewspaperIndexResponse>> {
  const prisma = getPrisma();
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10));

  const [rows, total] = await Promise.all([
    prisma.newspaperEdition.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { editionAt: 'desc' },
    }),
    prisma.newspaperEdition.count(),
  ]);

  const editions = rows.map(e => ({
    id: e.id,
    editionNumber: Math.floor(e.editionAt / TICKS_PER_EDITION),
    publishedAt: tickToISOString(e.editionAt),
    headline: extractHeadline(e.content),
  }));

  return NextResponse.json({ editions, total, page });
}
