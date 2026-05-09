import Link from 'next/link';
import { formatJobType, formatActivity } from '@/lib/format';

interface CitizenCardProps {
  id: string;
  name: string;
  age: number;
  jobType: string;
  districtName: string;
  currentActivity: string;
  biography: string | null;
}

export function CitizenCard({
  id, name, age, jobType, districtName, currentActivity, biography,
}: CitizenCardProps): React.ReactElement {
  const excerpt = biography
    ? biography.slice(0, 120) + (biography.length > 120 ? '…' : '')
    : null;

  return (
    <Link href={`/citizens/${id}`} className="block group">
      <article className="border border-gray-800 rounded p-5 hover:border-gray-600 transition-colors bg-gray-900 hover:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-medium text-white group-hover:text-gray-100 truncate">{name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {age} · {formatJobType(jobType)} · {districtName}
            </p>
          </div>
          <span className="text-xs text-gray-600 shrink-0 mt-0.5">{formatActivity(currentActivity)}</span>
        </div>
        {excerpt && (
          <p className="text-sm text-gray-400 mt-3 leading-relaxed line-clamp-2">{excerpt}</p>
        )}
      </article>
    </Link>
  );
}
