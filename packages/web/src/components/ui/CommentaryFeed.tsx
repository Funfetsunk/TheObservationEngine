'use client';

import type { WsEventMessage } from '@/types/ws';

const MAX_LINES = 15;

function formatEventLine(event: WsEventMessage): string {
  const names = event.citizenNames.slice(0, 2).join(' and ');
  switch (event.eventType) {
    case 'relationship_formed':
      return `${names} met for the first time.`;
    case 'relationship_changed':
      return `${names} — their relationship has shifted.`;
    case 'needs_crisis':
      return `${event.citizenNames[0] ?? 'Someone'} is struggling.`;
    case 'pub_visit':
      return `${names} at The Miner's Rest.`;
    case 'church_visit':
      return `${names} at St. Aldred's Church.`;
    case 'workplace_incident':
      return `Incident at work involving ${names}.`;
    default:
      return `${names} — ${event.eventType.replace(/_/g, ' ')}.`;
  }
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
}

interface CommentaryFeedProps {
  events: WsEventMessage[];
}

export function CommentaryFeed({ events }: CommentaryFeedProps): React.ReactElement {
  const visible = events.slice(-MAX_LINES).reverse();

  return (
    <aside className="flex flex-col h-full">
      <div className="text-xs text-gray-500 uppercase tracking-widest mb-3 px-1">Live feed</div>
      {visible.length === 0 ? (
        <p className="text-xs text-gray-600 px-1">Waiting for events…</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto flex-1">
          {visible.map((e, i) => (
            <li
              key={e.eventId}
              className={`text-xs px-2 py-1.5 rounded ${i === 0 ? 'bg-gray-800 text-gray-200' : 'text-gray-500'}`}
            >
              <span className="block">{formatEventLine(e)}</span>
              <span className="text-gray-600 mt-0.5 block">{formatTime(e.simulatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
