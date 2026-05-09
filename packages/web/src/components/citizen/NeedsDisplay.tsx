interface NeedsDisplayProps {
  needs: {
    hunger: number;
    energy: number;
    social: number;
  };
}

function needColour(value: number): string {
  if (value < 0.2) return 'bg-red-500';
  if (value < 0.4) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export function NeedsDisplay({ needs }: NeedsDisplayProps): React.ReactElement {
  const rows = [
    { label: 'Hunger', value: needs.hunger },
    { label: 'Energy', value: needs.energy },
    { label: 'Social', value: needs.social },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-14 shrink-0">{label}</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${needColour(value)}`}
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-8 text-right tabular-nums">
            {Math.round(value * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
