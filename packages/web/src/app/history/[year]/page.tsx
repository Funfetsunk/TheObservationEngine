import { getPrisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface Props {
  params: Promise<{ year: string }>;
}

export default async function HistoryYearPage({ params }: Props): Promise<React.ReactElement> {
  const { year } = await params;
  const simYear = parseInt(year, 10);
  if (isNaN(simYear) || simYear < 1) notFound();

  const prisma = getPrisma();
  const summary = await prisma.historicalSummary.findFirst({ where: { simYear } });
  if (!summary) notFound();

  const paragraphs = summary.content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/history" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Historical Record
        </Link>
      </div>

      <header className="mb-8 border-b border-gray-800 pb-6">
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Wixbury Annual Retrospective</p>
        <h1 className="font-serif text-3xl text-white tracking-tight">Year {summary.simYear}</h1>
        <p className="text-xs text-gray-600 mt-2">
          Ticks {summary.yearStart}–{summary.yearEnd}
        </p>
      </header>

      <article className="space-y-4">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-gray-300 leading-relaxed text-sm">
            {para}
          </p>
        ))}
      </article>

      <footer className="mt-10 pt-6 border-t border-gray-800 flex gap-4 text-sm">
        {simYear > 1 && (
          <Link href={`/history/${simYear - 1}`} className="text-gray-500 hover:text-gray-300 transition-colors">
            ← Year {simYear - 1}
          </Link>
        )}
        <Link href={`/history/${simYear + 1}`} className="text-gray-500 hover:text-gray-300 transition-colors ml-auto">
          Year {simYear + 1} →
        </Link>
      </footer>
    </div>
  );
}
