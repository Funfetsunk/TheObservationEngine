import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import { ArticleView } from '@/components/newspaper/ArticleView';

const TICKS_PER_EDITION = 168;
const SIGNIFICANCE_THRESHOLD = 0.6;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditionPage({ params }: Props): Promise<React.ReactElement> {
  const { id } = await params;
  const prisma = getPrisma();

  const edition = await prisma.newspaperEdition.findUnique({ where: { id } });
  if (!edition) notFound();

  const eventsCount = await prisma.event.count({
    where: {
      occurredAt: { gte: edition.weekStart, lte: edition.weekEnd },
      significance: { gte: SIGNIFICANCE_THRESHOLD },
    },
  });

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/newspaper" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← The Wixbury Gazette
        </Link>
      </div>

      <ArticleView
        editionNumber={Math.floor(edition.editionAt / TICKS_PER_EDITION)}
        publishedAt={tickToISOString(edition.editionAt)}
        content={edition.content}
        eventsCount={eventsCount}
      />
    </div>
  );
}
