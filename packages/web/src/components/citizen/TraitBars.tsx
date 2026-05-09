interface Trait {
  label: string;
  value: number;
}

interface TraitBarsProps {
  traits: {
    ambition: number;
    honesty: number;
    sociability: number;
    empathy: number;
    riskTolerance: number;
    religiosity: number;
    political: number;
  };
}

export function TraitBars({ traits }: TraitBarsProps): React.ReactElement {
  const rows: Trait[] = [
    { label: 'Ambition', value: traits.ambition },
    { label: 'Honesty', value: traits.honesty },
    { label: 'Sociability', value: traits.sociability },
    { label: 'Empathy', value: traits.empathy },
    { label: 'Risk tolerance', value: traits.riskTolerance },
    { label: 'Religiosity', value: traits.religiosity },
    { label: 'Political', value: traits.political },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-28 shrink-0">{label}</span>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${Math.round(value * 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-600 w-8 text-right tabular-nums">
            {Math.round(value * 100)}
          </span>
        </div>
      ))}
    </div>
  );
}
