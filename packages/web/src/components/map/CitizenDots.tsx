import React from 'react';
import { DISTRICT_LAYOUT, getCitizenPosition } from '@/lib/district-layout';
import { activityColour } from '@/lib/activity-colours';

export interface CitizenSnapshot {
  id: string;
  name: string;
  districtId: string;
  activity: string;
}

interface CitizenDotsProps {
  citizens: CitizenSnapshot[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}

export function CitizenDots({ citizens, selectedId, onSelect }: CitizenDotsProps): React.ReactElement {
  return (
    <g>
      {citizens.map(c => {
        const layout = DISTRICT_LAYOUT[c.districtId];
        if (!layout) return null;

        const { x, y } = getCitizenPosition(c.id, layout);
        const colour = activityColour(c.activity);
        const selected = c.id === selectedId;

        return (
          <g
            key={c.id}
            onClick={() => onSelect?.(c.id)}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              transition: 'transform 2s ease-in-out',
              cursor: onSelect ? 'pointer' : 'default',
            }}
            aria-label={`${c.name} — ${c.activity}`}
          >
            {selected && (
              <circle cx={0} cy={0} r={8} fill="none" stroke="white" strokeWidth={1.5} opacity={0.7} />
            )}
            <circle
              cx={0}
              cy={0}
              r={selected ? 5 : 4}
              fill={colour}
              opacity={selected ? 1 : 0.85}
            />
          </g>
        );
      })}
    </g>
  );
}
