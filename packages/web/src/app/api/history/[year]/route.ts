import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import type { HistoryYearResponse } from '@/types/api';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ year: string }> },
): Promise<NextResponse<HistoryYearResponse> | NextResponse<{ error: string }>> {
  const { year } = await params;
  const simYear = parseInt(year, 10);
  if (isNaN(simYear) || simYear < 1) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const prisma = getPrisma();
  const summary = await prisma.historicalSummary.findFirst({
    where: { simYear },
  });

  if (!summary) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: summary.id,
    simYear: summary.simYear,
    yearStart: summary.yearStart,
    yearEnd: summary.yearEnd,
    content: summary.content,
  });
}
