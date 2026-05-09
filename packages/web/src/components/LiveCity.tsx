'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useCityState } from '@/hooks/useCityState';
import { CityMap } from './map/CityMap';
import { CommentaryFeed } from './ui/CommentaryFeed';
import type { CitizenSnapshot } from './map/CitizenDots';
import type { WsEventMessage } from '@/types/ws';
import type { CitizenProfileResponse } from '@/types/api';

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

function needBar(label: string, value: number): React.ReactElement {
  const pct = Math.round(value * 100);
  const colour = value < 0.2 ? 'bg-red-500' : value < 0.5 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div key={label} className="flex items-center gap-2">
      <span className="text-gray-500 text-xs w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${colour} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function CitizenPanel({ id, onClose }: { id: string; onClose: () => void }): React.ReactElement {
  const [profile, setProfile] = useState<CitizenProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setProfile(null);
    fetch(`/api/citizens/${id}`)
      .then(r => r.ok ? r.json() as Promise<CitizenProfileResponse> : Promise.reject())
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Selected</span>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-300 transition-colors text-xs"
          aria-label="Deselect citizen"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-gray-600 animate-pulse">Loading…</span>
        </div>
      )}

      {!loading && !profile && (
        <p className="text-xs text-gray-600">Could not load profile.</p>
      )}

      {profile && (
        <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
          <div>
            <p className="text-white font-medium text-sm">{profile.name}</p>
            <p className="text-gray-400 text-xs">{profile.age} · {profile.jobType.replace('_', ' ')} · {profile.districtName}</p>
            <p className="text-gray-500 text-xs mt-0.5">{profile.currentActivity}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            {needBar('Hunger', profile.needs.hunger)}
            {needBar('Energy', profile.needs.energy)}
            {needBar('Social', profile.needs.social)}
          </div>

          {profile.biography && (
            <p className="text-gray-500 text-xs leading-relaxed line-clamp-4">{profile.biography}</p>
          )}

          {profile.relationships.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Knows</p>
              <ul className="flex flex-col gap-0.5">
                {profile.relationships.slice(0, 4).map(r => (
                  <li key={r.citizenId} className="flex justify-between text-xs">
                    <span className="text-gray-400 truncate">{r.citizenName}</span>
                    <span className="text-gray-600 ml-2 shrink-0">{r.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <a
            href={`/citizens/${profile.id}`}
            className="text-indigo-400 hover:text-indigo-300 transition-colors text-xs mt-auto"
          >
            View full profile →
          </a>
        </div>
      )}
    </div>
  );
}

export function LiveCity({
  initialCitizens,
  districts,
  initialTick,
  initialSimulatedAt,
}: LiveCityProps): React.ReactElement {
  const { tick, simulatedAt, citizens, lastEvent, connected } = useCityState(initialCitizens);
  const [events, setEvents] = useState<WsEventMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const prevSelectedId = useRef<string | undefined>();

  useEffect(() => {
    if (!lastEvent) return;
    setEvents(prev => {
      const next = [...prev, lastEvent];
      return next.length > MAX_STORED_EVENTS ? next.slice(-MAX_STORED_EVENTS) : next;
    });
  }, [lastEvent]);

  // Shallow URL update on selection change
  useEffect(() => {
    if (prevSelectedId.current === selectedId) return;
    prevSelectedId.current = selectedId;
    const url = selectedId ? `/citizens/${selectedId}` : '/';
    window.history.replaceState({}, '', url);
  }, [selectedId]);

  const handleSelect = useCallback((id: string | undefined) => {
    setSelectedId(prev => (prev === id ? undefined : id));
  }, []);

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

      {/* Selected citizen banner (mobile: above map) */}
      {selectedId && (() => {
        const c = citizens.find(ci => ci.id === selectedId);
        return c ? (
          <div className="flex lg:hidden items-center justify-between bg-gray-800 border border-gray-700 rounded px-4 py-2 text-sm">
            <span className="text-gray-200">
              <span className="font-medium text-white">{c.name}</span>
              <span className="text-gray-400 ml-2">— {c.activity}</span>
            </span>
            <div className="flex gap-3">
              <a href={`/citizens/${c.id}`} className="text-indigo-400 hover:text-indigo-300 transition-colors text-xs">
                View profile →
              </a>
              <button onClick={() => handleSelect(undefined)} className="text-gray-500 hover:text-gray-300 transition-colors text-xs" aria-label="Deselect">✕</button>
            </div>
          </div>
        ) : null;
      })()}

      {/* Two-column layout: map + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4 items-start">
        <CityMap
          citizens={citizens}
          districts={districts}
          lastEvent={lastEvent}
          selectedId={selectedId}
          onSelect={handleSelect}
        />

        <div className="hidden lg:block bg-gray-900 border border-gray-800 rounded-lg p-4 h-[420px]">
          {selectedId
            ? <CitizenPanel id={selectedId} onClose={() => handleSelect(undefined)} />
            : <CommentaryFeed events={events} />
          }
        </div>
      </div>
    </div>
  );
}
