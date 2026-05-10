'use client';

import { useEffect, useState } from 'react';
import type { CitizenProfileResponse } from '@/types/api';
import { formatActivity } from '@/lib/format';

const POLL_INTERVAL_MS = 60_000;

interface Props {
  id: string;
  initialActivity: string;
}

export function ActivityBadge({ id, initialActivity }: Props): React.ReactElement {
  const [activity, setActivity] = useState(initialActivity);

  useEffect(() => {
    const refresh = (): void => {
      fetch(`/api/citizens/${id}`)
        .then(r => r.ok ? r.json() as Promise<CitizenProfileResponse> : Promise.reject())
        .then(data => setActivity(formatActivity(data.currentActivity)))
        .catch(() => { /* keep last known value */ });
    };

    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [id]);

  return (
    <span className="text-xs bg-gray-800 text-gray-400 px-2.5 py-1 rounded shrink-0">
      {activity}
    </span>
  );
}
