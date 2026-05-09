import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import { CitizenCard } from '@/components/citizen/CitizenCard';

const PAGE_SIZE = 50;

interface Props {
  searchParams: Promise<{ page?: string; district?: string; job?: string }>;
}

export default async function CitizensPage({ searchParams }: Props): Promise<React.ReactElement> {
  const { page: pageParam, district, job } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  const prisma = getPrisma();

  const where = {
    diedAt: null,
    ...(district ? { homeDistrictId: district } : {}),
    ...(job ? { jobType: job } : {}),
  };

  const [rows, total, districts] = await Promise.all([
    prisma.citizen.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { name: 'asc' },
      include: { homeDistrict: true },
    }),
    prisma.citizen.count({ where }),
    prisma.district.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8 border-b border-gray-800 pb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Citizens</h1>
          <p className="text-sm text-gray-500 mt-1">{total} living resident{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <select
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none"
            defaultValue={district ?? ''}
            onChange={undefined}
            aria-label="Filter by district"
          >
            <option value="">All districts</option>
            {districts.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="text-gray-500 text-sm">No citizens found.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(c => (
            <CitizenCard
              key={c.id}
              id={c.id}
              name={c.name}
              age={c.age}
              jobType={c.jobType}
              districtName={c.homeDistrict.name}
              currentActivity={c.currentAction}
              biography={c.biography}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex gap-3 mt-8 justify-center text-sm">
          {page > 1 && (
            <a href={`/citizens?page=${page - 1}`} className="text-gray-400 hover:text-white transition-colors">
              ← Previous
            </a>
          )}
          <span className="text-gray-600">{page} / {totalPages}</span>
          {page < totalPages && (
            <a href={`/citizens?page=${page + 1}`} className="text-gray-400 hover:text-white transition-colors">
              Next →
            </a>
          )}
        </nav>
      )}
    </div>
  );
}
