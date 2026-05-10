import { getPrisma } from '@/lib/prisma';
import Link from 'next/link';

const PAGE_SIZE = 10;
const PREVIEW_LENGTH = 200;

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function HistoryPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.historicalSummary.findMany({
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { simYear: 'desc' },
    }),
    prisma.historicalSummary.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h1 className="font-serif text-3xl text-white tracking-tight">Wixbury — Historical Record</h1>
        <p className="text-sm text-gray-500 mt-1">{total} year{total !== 1 ? 's' : ''} recorded</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No historical summaries yet. The first will be written at the close of Year 1.</p>
      ) : (
        <div className="space-y-6">
          {rows.map(s => {
            const preview = s.content.slice(0, PREVIEW_LENGTH).trimEnd() +
              (s.content.length > PREVIEW_LENGTH ? '…' : '');
            return (
              <Link
                key={s.id}
                href={`/history/${s.simYear}`}
                className="block group rounded border border-gray-800 p-5 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className="font-serif text-lg text-white group-hover:text-gray-200 transition-colors">
                    Year {s.simYear}
                  </span>
                  <span className="text-xs text-gray-600">
                    ticks {s.yearStart}–{s.yearEnd}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">{preview}</p>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex gap-3 mt-8 justify-center text-sm">
          {page > 1 && (
            <a href={`/history?page=${page - 1}`} className="text-gray-400 hover:text-white transition-colors">
              ← Earlier
            </a>
          )}
          <span className="text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/history?page=${page + 1}`} className="text-gray-400 hover:text-white transition-colors">
              Later →
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
