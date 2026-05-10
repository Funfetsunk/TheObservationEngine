import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { HistoryIndexResponse } from '@/types/api';

const PAGE_SIZE = 10;
const PREVIEW_LENGTH = 200;

export async function GET(request: NextRequest): Promise<NextResponse<HistoryIndexResponse>> {
  const prisma = getPrisma();
  const { searchParams } = request.nextUrl;

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? String(PAGE_SIZE), 10));

  const [rows, total] = await Promise.all([
    prisma.historicalSummary.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { simYear: 'desc' },
    }),
    prisma.historicalSummary.count(),
  ]);

  const summaries = rows.map(s => ({
    id: s.id,
    simYear: s.simYear,
    yearStart: s.yearStart,
    yearEnd: s.yearEnd,
    preview: s.content.slice(0, PREVIEW_LENGTH).trimEnd() + (s.content.length > PREVIEW_LENGTH ? '…' : ''),
  }));

  return NextResponse.json({ summaries, total, page });
}
