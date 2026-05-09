'use client';

import { useEffect, useRef, useState } from 'react';
import { useCityState } from '@/hooks/useCityState';
import { CityMap } from './map/CityMap';
import { CommentaryFeed } from './ui/CommentaryFeed';
import type { CitizenSnapshot } from './map/CitizenDots';
import type { WsEventMessage } from '@/types/ws';

const MAX_STORED_EVENTS = 50;

interface DistrictInfo {
  id: string;
  name: string;
  citizenCount: number;
}

interface LiveCityProps {
  initialCitizens: CitizenSnapshot[];
  districts: DistrictInfo[];
  initialTick: number;
  initialSimulatedAt: string;
}

function formatSimClock(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export function LiveCity({
  initialCitizens,
  districts,
  initialTick,
  initialSimulatedAt,
}: LiveCityProps): React.ReactElement {
  const { tick, simulatedAt, citizens, lastEvent, connected } = useCityState(initialCitizens);
  const [events, setEvents] = useState<WsEventMessage[]>([]);

  useEffect(() => {
    if (!lastEvent) return;
    setEvents(prev => {
      const next = [...prev, lastEvent];
      return next.length > MAX_STORED_EVENTS ? next.slice(-MAX_STORED_EVENTS) : next;
    });
  }, [lastEvent]);

  const displayTick = tick || initialTick;
  const displayAt = simulatedAt || initialSimulatedAt;

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: clock + connection status */}
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-sm text-gray-300">{formatSimClock(displayAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-gray-600'}`}
            title={connected ? 'Live' : 'Connecting…'}
          />
          <span className="text-xs text-gray-600">Tick {displayTick}</span>
        </div>
      </div>

      {/* Two-column layout: map + feed */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-start">
        <CityMap citizens={citizens} districts={districts} lastEvent={lastEvent} />

        <div className="hidden lg:block bg-gray-900 border border-gray-800 rounded-lg p-4 h-[420px]">
          <CommentaryFeed events={events} simulatedAt={displayAt} />
        </div>
      </div>
    </div>
  );
}
