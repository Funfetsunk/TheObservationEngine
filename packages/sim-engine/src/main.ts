import { getPrismaClient } from '@wixbury/db';
import { Redis } from 'ioredis';
import { Citizen, CitizenAction, JobType } from '@wixbury/shared';
import { seed } from './seed';
import { loadTickState } from './db-sync';
import { RelationshipEngine } from './relationship-engine';
import { startTickEngine } from './tick-engine';
import { MIN_WORK_HOURS, MAX_WORK_HOURS } from './constants';

interface DbCitizenRow {
  id: string;
  name: string;
  age: number;
  jobType: string;
  homeDistrictId: string;
  currentLocationId: string;
  currentAction: string;
  needHunger: number;
  needEnergy: number;
  needSocial: number;
  workedTodayTicks: number;
  traitAmbition: number;
  traitHonesty: number;
  traitSociability: number;
  traitEmpathy: number;
  traitRiskTolerance: number;
  traitReligiosity: number;
  traitPolitical: number;
}

function dbRowToCitizen(row: DbCitizenRow): Citizen {
  const job = row.jobType as JobType;
  const dailyWorkTarget =
    job === JobType.Unemployed
      ? 0
      : Math.round(MIN_WORK_HOURS + row.traitAmbition * (MAX_WORK_HOURS - MIN_WORK_HOURS));
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    job,
    homeDistrictId: row.homeDistrictId,
    currentLocationId: row.currentLocationId,
    traits: {
      ambition: row.traitAmbition,
      honesty: row.traitHonesty,
      sociability: row.traitSociability,
      empathy: row.traitEmpathy,
      riskTolerance: row.traitRiskTolerance,
      religiosity: row.traitReligiosity,
      political: row.traitPolitical,
    },
    needs: {
      hunger: row.needHunger,
      energy: row.needEnergy,
      social: row.needSocial,
    },
    currentAction: row.currentAction as CitizenAction,
    dailyWorkTarget,
    workedTodayTicks: row.workedTodayTicks,
  };
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379');

  redis.on('error', (err: Error) => {
    console.error(JSON.stringify({ event: 'redis_error', error: err.message }));
  });

  const districtCount = await prisma.district.count();
  if (districtCount === 0) {
    await seed(prisma);
  }

  const dbCitizens = await prisma.citizen.findMany({ where: { diedAt: null } });
  const citizens: Citizen[] = dbCitizens.map(row => dbRowToCitizen(row as DbCitizenRow));

  const tickState = await loadTickState(redis);

  const relationships = new RelationshipEngine();
  await relationships.load(prisma);

  console.log(JSON.stringify({
    event: 'sim_start',
    citizens: citizens.length,
    tick: tickState.tickNumber,
    relationships: relationships.getCount(),
  }));

  startTickEngine(citizens, relationships, prisma, redis, tickState.tickNumber);
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({
    event: 'fatal',
    error: err instanceof Error ? err.message : String(err),
  }));
  process.exit(1);
});
