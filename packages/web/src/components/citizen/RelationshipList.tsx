import Link from 'next/link';
import { formatRelationshipType, formatSimDate } from '@/lib/format';

interface Relationship {
  citizenId: string;
  citizenName: string;
  score: number;
  type: string;
  formedAt: string;
}

interface RelationshipListProps {
  relationships: Relationship[];
}

function scoreColour(score: number): string {
  if (score < -0.2) return 'text-red-400';
  if (score > 0.4) return 'text-emerald-400';
  return 'text-gray-400';
}

export function RelationshipList({ relationships }: RelationshipListProps): React.ReactElement {
  if (relationships.length === 0) {
    return <p className="text-sm text-gray-600">No relationships yet.</p>;
  }

  return (
    <ul className="divide-y divide-gray-800">
      {relationships.map(r => (
        <li key={r.citizenId} className="flex items-center justify-between py-2.5 gap-4">
          <div className="min-w-0">
            <Link
              href={`/citizens/${r.citizenId}`}
              className="text-sm text-gray-200 hover:text-white transition-colors"
            >
              {r.citizenName}
            </Link>
            <p className="text-xs text-gray-600 mt-0.5">
              {formatRelationshipType(r.type)} · since {formatSimDate(r.formedAt)}
            </p>
          </div>
          <span className={`text-xs tabular-nums shrink-0 ${scoreColour(r.score)}`}>
            {r.score >= 0 ? '+' : ''}{r.score.toFixed(2)}
          </span>
        </li>
      ))}
    </ul>
  );
}
