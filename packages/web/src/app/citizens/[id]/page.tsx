import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPrisma } from '@/lib/prisma';
import { tickToISOString } from '@/lib/simulated-time';
import { TraitBars } from '@/components/citizen/TraitBars';
import { NeedsDisplay } from '@/components/citizen/NeedsDisplay';
import { RelationshipList } from '@/components/citizen/RelationshipList';
import { formatJobType, formatActivity, formatSimDate } from '@/lib/format';

const RECENT_EVENTS_LIMIT = 10;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CitizenProfilePage({ params }: Props): Promise<React.ReactElement> {
  const { id } = await params;
  const prisma = getPrisma();

  const [citizen, recentEvents] = await Promise.all([
    prisma.citizen.findUnique({
      where: { id },
      include: {
        homeDistrict: true,
        relationshipsAsA: { include: { citizenB: true }, orderBy: { score: 'desc' } },
        relationshipsAsB: { include: { citizenA: true }, orderBy: { score: 'desc' } },
      },
    }),
    prisma.event.findMany({
      where: { citizenIds: { has: id } },
      take: RECENT_EVENTS_LIMIT,
      orderBy: { occurredAt: 'desc' },
      include: { district: true },
    }),
  ]);

  if (!citizen) notFound();

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

  const traits = {
    ambition: citizen.traitAmbition,
    honesty: citizen.traitHonesty,
    sociability: citizen.traitSociability,
    empathy: citizen.traitEmpathy,
    riskTolerance: citizen.traitRiskTolerance,
    religiosity: citizen.traitReligiosity,
    political: citizen.traitPolitical,
  };

  const needs = {
    hunger: citizen.needHunger,
    energy: citizen.needEnergy,
    social: citizen.needSocial,
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/citizens" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Citizens
        </Link>
      </div>

      {/* Header */}
      <header className="border-b border-gray-800 pb-8 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-white">{citizen.name}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {citizen.age} years old · {formatJobType(citizen.jobType)} · {citizen.homeDistrict.name}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Born {formatSimDate(tickToISOString(citizen.bornAt))}
              {citizen.diedAt !== null && ` · Died ${formatSimDate(tickToISOString(citizen.diedAt))}`}
            </p>
          </div>
          <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded shrink-0">
            {formatActivity(citizen.currentAction)}
          </span>
        </div>

        {citizen.biography && (
          <p className="mt-5 text-sm text-gray-300 leading-relaxed">{citizen.biography}</p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        {/* Traits */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Traits</h2>
          <TraitBars traits={traits} />
        </section>

        {/* Needs */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Current needs</h2>
          <NeedsDisplay needs={needs} />
        </section>
      </div>

      {/* Relationships */}
      <section className="mb-10">
        <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">
          Relationships ({relationships.length})
        </h2>
        <RelationshipList relationships={relationships} />
      </section>

      {/* Recent events */}
      <section>
        <h2 className="text-xs text-gray-500 uppercase tracking-widest mb-4">Recent events</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-600">No events recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {recentEvents.map(e => {
              const data = e.data as Record<string, unknown>;
              const description = typeof data.citizenAName === 'string' && typeof data.citizenBName === 'string'
                ? `${data.citizenAName} & ${data.citizenBName}`
                : e.citizenIds.length > 0 ? `${e.citizenIds.length} citizen(s)` : '';

              return (
                <li key={e.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-gray-300 capitalize">
                      {e.type.replace(/_/g, ' ')}
                      {description ? ` — ${description}` : ''}
                    </span>
                    <time className="text-xs text-gray-600 shrink-0">
                      {formatSimDate(tickToISOString(e.occurredAt))}
                    </time>
                  </div>
                  {e.district && (
                    <p className="text-xs text-gray-600 mt-0.5">{e.district.name}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
