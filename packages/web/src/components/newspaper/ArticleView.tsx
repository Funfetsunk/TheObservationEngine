interface ArticleViewProps {
  editionNumber: number;
  publishedAt: string;
  content: string;
  eventsCount: number;
}

export function ArticleView({ editionNumber, publishedAt, content, eventsCount }: ArticleViewProps): React.ReactElement {
  const date = new Date(publishedAt).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const paragraphs = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  return (
    <article className="max-w-2xl mx-auto">
      <header className="border-b border-gray-700 pb-6 mb-8 text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
          Edition {editionNumber} · {eventsCount} event{eventsCount !== 1 ? 's' : ''}
        </p>
        <time className="block text-sm text-gray-400">{date}</time>
      </header>

      <div className="font-serif text-gray-200 leading-relaxed space-y-5 text-[1.0625rem]">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}
