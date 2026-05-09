'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DistrictLayer } from './DistrictLayer';
import { CitizenDots, CitizenSnapshot } from './CitizenDots';
import { EventFlash } from './EventFlash';
import { ACTIVITY_COLOUR } from '@/lib/activity-colours';
import type { WsEventMessage } from '@/types/ws';

interface DistrictInfo {
  id: string;
  name: string;
  citizenCount: number;
}

interface CityMapProps {
  citizens: CitizenSnapshot[];
  districts: DistrictInfo[];
  lastEvent: WsEventMessage | null;
}

export function CityMap({ citizens, districts, lastEvent }: CityMapProps): React.ReactElement {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const router = useRouter();

  function handleSelect(id: string): void {
    if (selectedId === id) {
      setSelectedId(undefined);
    } else {
      setSelectedId(id);
      router.prefetch(`/citizens/${id}`);
    }
  }

  const selected = citizens.find(c => c.id === selectedId);

  return (
    <div className="flex flex-col gap-4">
      {selected && (
        <div className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded px-4 py-2 text-sm">
          <span className="text-gray-200">
            <span className="font-medium text-white">{selected.name}</span>
            <span className="text-gray-400 ml-2">— {selected.activity}</span>
          </span>
          <div className="flex gap-3">
            <a href={`/citizens/${selected.id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors text-xs">
              View profile →
            </a>
            <button
              onClick={() => setSelectedId(undefined)}
              className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
              aria-label="Deselect citizen"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <svg
          viewBox="0 0 600 500"
          className="w-full h-auto"
          aria-label="Wixbury city map"
          role="img"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(undefined); }}
        >
          <DistrictLayer districts={districts} />
          <CitizenDots citizens={citizens} selectedId={selectedId} onSelect={handleSelect} />
          <EventFlash lastEvent={lastEvent} />
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1">
        {Object.entries(ACTIVITY_COLOUR).map(([key, { fill, label }]) => (
          <div key={key} className="flex items-center gap-1.5">
            <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden>
              <circle cx={4} cy={4} r={4} fill={fill} />
            </svg>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
