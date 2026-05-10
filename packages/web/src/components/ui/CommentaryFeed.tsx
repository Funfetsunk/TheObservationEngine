'use client';

import type { WsEventMessage } from '@/types/ws';

const MAX_LINES = 15;

const RELATIONSHIP_CHANGE_MESSAGES: Record<string, Record<string, string>> = {
  acquaintance: {
    friend:      '{a} and {b} have become friends.',
    colleague:   '{a} and {b} have struck up a working friendship.',
    rival:       '{a} and {b} have fallen out.',
    romantic:    '{a} and {b} have grown close.',
    family:      '{a} and {b} have grown closer as family.',
  },
  friend: {
    acquaintance: '{a} and {b} have drifted apart.',
    colleague:    '{a} and {b} are keeping things professional now.',
    rival:        '{a} and {b} are no longer on speaking terms.',
    romantic:     '{a} and {b} are in a relationship.',
    family:       '{a} and {b} have grown inseparable.',
  },
  colleague: {
    acquaintance: '{a} and {b} barely acknowledge each other now.',
    friend:       '{a} and {b} have become proper friends.',
    rival:        '{a} and {b} are at odds at work.',
    romantic:     '{a} and {b} have become more than colleagues.',
  },
  rival: {
    acquaintance: '{a} and {b} have buried the hatchet.',
    friend:       '{a} and {b} have put their differences aside.',
    colleague:    '{a} and {b} have reached an uneasy truce.',
    romantic:     '{a} and {b} have a complicated history.',
  },
  romantic: {
    acquaintance: '{a} and {b} have gone their separate ways.',
    friend:       '{a} and {b} remain friends after everything.',
    colleague:    '{a} and {b} are keeping things professional.',
    rival:        '{a} and {b} have had a bitter falling out.',
  },
  family: {
    acquaintance: '{a} and {b} are estranged.',
    friend:       '{a} and {b} have reconnected.',
    rival:        '{a} and {b} are in a family dispute.',
  },
};

function formatRelationshipChange(a: string, b: string, from: string, to: string): string {
  const template = RELATIONSHIP_CHANGE_MESSAGES[from]?.[to];
  if (template) return template.replace('{a}', a).replace('{b}', b);
  return `${a} and ${b} — their relationship has changed.`;
}

function formatEventLine(event: WsEventMessage): string {
  const [a, b] = event.citizenNames;
  const names = [a, b].filter(Boolean).join(' and ');
  const d = event.eventData;

  switch (event.eventType) {
    case 'relationship_formed':
      return `${names} met for the first time.`;
    case 'relationship_changed': {
      const from = typeof d?.from === 'string' ? d.from : null;
      const to   = typeof d?.to   === 'string' ? d.to   : null;
      if (a && b && from && to) return formatRelationshipChange(a, b, from, to);
      return `${names} — their relationship has shifted.`;
    }
    case 'needs_crisis':
      return `${event.citizenNames[0] ?? 'Someone'} is struggling.`;
    case 'pub_visit':
      return `${names} at The Miner's Rest.`;
    case 'church_visit':
      return `${names} at St. Aldred's Church.`;
    case 'workplace_incident':
      return `Incident at work involving ${names}.`;
    case 'strike': {
      const biz = typeof d?.businessName === 'string' ? d.businessName : null;
      return biz ? `Workers at ${biz} have gone on strike.` : `Workers have gone on strike.`;
    }
    case 'business_closed': {
      const biz = typeof d?.businessName === 'string' ? d.businessName : null;
      return biz ? `${biz} has closed.` : `A business has closed.`;
    }
    case 'business_sold': {
      const biz = typeof d?.businessName === 'string' ? d.businessName : null;
      const buyer = typeof d?.buyerName === 'string' ? d.buyerName : null;
      return biz && buyer ? `${biz} has been sold to ${buyer}.` : `A business has changed hands.`;
    }
    case 'unemployment_spike':
      return `Unemployment is rising in Wixbury.`;
    case 'promotion':
      return `${event.citizenNames[0] ?? 'Someone'} has been promoted.`;
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
