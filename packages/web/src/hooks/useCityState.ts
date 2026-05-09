'use client';

import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from './useWebSocket';
import type { CitizenSnapshot } from '@/components/map/CitizenDots';
import type { WsEventMessage, WsEditionMessage } from '@/types/ws';

export interface CityState {
  tick: number;
  simulatedAt: string;
  citizens: CitizenSnapshot[];
  lastEvent: WsEventMessage | null;
  lastEdition: WsEditionMessage | null;
  connected: boolean;
}

export function useCityState(initialCitizens: CitizenSnapshot[]): CityState {
  const [tick, setTick] = useState(0);
  const [simulatedAt, setSimulatedAt] = useState('');
  const [citizens, setCitizens] = useState<CitizenSnapshot[]>(initialCitizens);
  const [lastEvent, setLastEvent] = useState<WsEventMessage | null>(null);
  const [lastEdition, setLastEdition] = useState<WsEditionMessage | null>(null);

  // Keep initialCitizens as fallback if no tick received yet
  const tickReceived = useRef(false);
  const { lastMessage, connected } = useWebSocket();

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === 'tick') {
      tickReceived.current = true;
      setTick(lastMessage.tick);
      setSimulatedAt(lastMessage.simulatedAt);
      setCitizens(
        lastMessage.citizens.map(c => ({
          id: c.id,
          name: c.name,
          districtId: c.districtId,
          activity: c.activity,
        })),
      );
    } else if (lastMessage.type === 'event') {
      setLastEvent(lastMessage);
    } else if (lastMessage.type === 'edition') {
      setLastEdition(lastMessage);
    }
  }, [lastMessage]);

  return {
    tick,
    simulatedAt,
    citizens: tickReceived.current ? citizens : initialCitizens,
    lastEvent,
    lastEdition,
    connected,
  };
}
