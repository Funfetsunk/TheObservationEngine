import { PrismaClient } from '@wixbury/db';
import { EventType } from '@wixbury/shared';

export interface PendingEvent {
  type: EventType;
  occurredAt: number;
  districtId?: string;
  citizenIds: string[];
  data: Record<string, unknown>;
  significance: number;
}

export async function emitEvents(events: PendingEvent[], prisma: PrismaClient): Promise<void> {
  if (events.length === 0) return;
  await prisma.event.createMany({
    data: events.map(e => ({
      type: e.type,
      occurredAt: e.occurredAt,
      districtId: e.districtId ?? null,
      citizenIds: e.citizenIds,
      data: e.data as object,
      significance: e.significance,
      writtenUp: false,
    })),
  });
}
