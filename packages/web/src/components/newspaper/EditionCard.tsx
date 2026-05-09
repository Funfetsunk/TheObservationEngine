import Link from 'next/link';

interface EditionCardProps {
  id: string;
  editionNumber: number;
  publishedAt: string;
  headline: string;
}

export function EditionCard({ id, editionNumber, publishedAt, headline }: EditionCardProps): React.ReactElement {
  const date = new Date(publishedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Link href={`/newspaper/${id}`} className="block group">
      <article className="border border-gray-800 rounded p-5 hover:border-gray-600 transition-colors bg-gray-900 hover:bg-gray-800">
        <div className="flex items-baseline justify-between gap-4 mb-2">
          <span className="text-xs text-gray-500 uppercase tracking-widest">
            Edition {editionNumber}
          </span>
          <time className="text-xs text-gray-500">{date}</time>
        </div>
        <h2 className="font-serif text-lg text-gray-100 group-hover:text-white leading-snug line-clamp-2">
          {headline}
        </h2>
      </article>
    </Link>
  );
}
