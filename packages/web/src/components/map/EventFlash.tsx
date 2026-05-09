'use client';

import { useEffect, useState } from 'react';
import { DISTRICT_LAYOUT } from '@/lib/district-layout';
import type { WsEventMessage } from '@/types/ws';

interface EventFlashProps {
  lastEvent: WsEventMessage | null;
}

interface Flash {
  key: number;
  cx: number;
  cy: number;
}

export function EventFlash({ lastEvent }: EventFlashProps): React.ReactElement {
  const [flash, setFlash] = useState<Flash | null>(null);

  useEffect(() => {
    if (!lastEvent?.districtId) return;
    const layout = DISTRICT_LAYOUT[lastEvent.districtId];
    if (!layout) return;
    setFlash({
      key: Date.now(),
      cx: layout.x + layout.width / 2,
      cy: layout.y + layout.height / 2,
    });
  }, [lastEvent]);

  if (!flash) return <g />;

  return (
    <g key={flash.key}>
      <circle
        cx={flash.cx}
        cy={flash.cy}
        r={0}
        fill="none"
        stroke="white"
        strokeWidth={1.5}
        opacity={0.6}
      >
        <animate attributeName="r" from="0" to="45" dur="1.2s" fill="freeze" />
        <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" fill="freeze" />
      </circle>
    </g>
  );
}
