'use client';

import { DistrictLayer } from './DistrictLayer';
import { CitizenDots, CitizenSnapshot } from './CitizenDots';
import { EventFlash } from './EventFlash';
import { ACTIVITY_COLOUR } from '@/lib/activity-colours';
import { DISTRICT_LAYOUT, getCitizenPosition } from '@/lib/district-layout';
import type { WsEventMessage } from '@/types/ws';

interface DistrictInfo {
  id: string;
  name: string;
  citizenCount: number;
  wealthScore?: number;
}

interface CityMapProps {
  citizens: CitizenSnapshot[];
  districts: DistrictInfo[];
  lastEvent: WsEventMessage | null;
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
}

const FULL_VIEWBOX = '0 0 600 500';
const ZOOM_W = 200;
const ZOOM_H = 160;

function computeViewBox(selectedId: string | undefined, citizens: CitizenSnapshot[]): string {
  if (!selectedId) return FULL_VIEWBOX;
  const c = citizens.find(ci => ci.id === selectedId);
  if (!c) return FULL_VIEWBOX;
  const layout = DISTRICT_LAYOUT[c.districtId];
  if (!layout) return FULL_VIEWBOX;
  const { x, y } = getCitizenPosition(c.id, layout);
  const vx = Math.max(0, Math.min(600 - ZOOM_W, x - ZOOM_W / 2));
  const vy = Math.max(0, Math.min(500 - ZOOM_H, y - ZOOM_H / 2));
  return `${vx.toFixed(1)} ${vy.toFixed(1)} ${ZOOM_W} ${ZOOM_H}`;
}

export function CityMap({ citizens, districts, lastEvent, selectedId, onSelect }: CityMapProps): React.ReactElement {
  const viewBox = computeViewBox(selectedId, citizens);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <svg
          viewBox={viewBox}
          style={{ transition: 'viewBox 0.4s ease' }}
          className="w-full h-auto"
          aria-label="Wixbury city map"
          role="img"
          onClick={(e) => { if (e.target === e.currentTarget) onSelect(undefined); }}
        >
          <DistrictLayer districts={districts} />
          <CitizenDots citizens={citizens} selectedId={selectedId} onSelect={(id) => onSelect(id)} />
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
