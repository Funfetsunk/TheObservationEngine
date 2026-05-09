import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import { EditionCard } from '@/components/newspaper/EditionCard';

const TICKS_PER_EDITION = 168;
const PAGE_SIZE = 10;

function extractHeadline(content: string): string {
  return content.split('\n').find(l => l.trim().length > 0)?.trim() ?? 'The Wixbury Gazette';
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function NewspaperPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  const prisma = getPrisma();
  const [rows, total] = await Promise.all([
    prisma.newspaperEdition.findMany({
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { editionAt: 'desc' },
    }),
    prisma.newspaperEdition.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8 border-b border-gray-800 pb-6">
        <h1 className="font-serif text-3xl text-white tracking-tight">The Wixbury Gazette</h1>
        <p className="text-sm text-gray-500 mt-1">{total} edition{total !== 1 ? 's' : ''} published</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No editions published yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(e => (
            <EditionCard
              key={e.id}
              id={e.id}
              editionNumber={Math.floor(e.editionAt / TICKS_PER_EDITION)}
              publishedAt={tickToISOString(e.editionAt)}
              headline={extractHeadline(e.content)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex gap-3 mt-8 justify-center text-sm">
          {page > 1 && (
            <a href={`/newspaper?page=${page - 1}`} className="text-gray-400 hover:text-white transition-colors">
              ← Older
            </a>
          )}
          <span className="text-gray-600">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <a href={`/newspaper?page=${page + 1}`} className="text-gray-400 hover:text-white transition-colors">
              Newer →
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
