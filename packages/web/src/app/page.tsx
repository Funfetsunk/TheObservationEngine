import { getPrisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { tickToISOString } from '@/lib/simulated-time';
import { LiveCity } from '@/components/LiveCity';

interface TickState {
  tickNumber: number;
}

async function getCityState(): Promise<{ tick: number; simulatedAt: string }> {
  let tick = 0;
  try {
    const redis = getRedisClient();
    const raw = await redis.get('wixbury:tick:state');
    if (raw) tick = (JSON.parse(raw) as TickState).tickNumber;
  } catch {
    // sim not running
  }
  return { tick, simulatedAt: tickToISOString(tick) };
}

export default async function HomePage(): Promise<React.ReactElement> {
  const prisma = getPrisma();

  const [{ tick, simulatedAt }, citizens, rawDistricts] = await Promise.all([
    getCityState(),
    prisma.citizen.findMany({
      where: { diedAt: null },
      select: { id: true, name: true, homeDistrictId: true, currentAction: true },
    }),
    prisma.district.findMany({
      include: { _count: { select: { citizens: { where: { diedAt: null } } } } },
    }),
  ]);

  const initialCitizens = citizens.map(c => ({
    id: c.id,
    name: c.name,
    districtId: c.homeDistrictId,
    activity: c.currentAction,
  }));

  const districts = rawDistricts.map(d => ({
    id: d.id,
    name: d.name,
    citizenCount: d._count.citizens,
    wealthScore: d.wealthScore,
  }));

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-5">
        <h1 className="text-lg font-medium text-white">Wixbury</h1>
        <p className="text-xs text-gray-600 mt-0.5">{citizens.length} residents · {rawDistricts.length} districts</p>
      </div>

      <LiveCity
        initialCitizens={initialCitizens}
        districts={districts}
        initialTick={tick}
        initialSimulatedAt={simulatedAt}
      />
    </div>
  );
}
