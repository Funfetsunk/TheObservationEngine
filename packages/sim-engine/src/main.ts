import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });
import { getPrismaClient } from '@wixbury/db';
import { Redis } from 'ioredis';
import { Business, BusinessType, Citizen, CitizenAction, JobType } from '@wixbury/shared';
import { seed } from './seed';
import { loadTickState } from './db-sync';
import { RelationshipEngine } from './relationship-engine';
import { startTickEngine } from './tick-engine';
import { createQueue, startWorker } from './queue';
import { AnthropicClient } from './llm/anthropic-client';
import { MockLLMClient } from './llm/mock-llm-client';
import { MIN_WORK_HOURS, MAX_WORK_HOURS } from './constants';
import { PopulationEngine } from './population-engine';
import { EconomyEngine } from './economy-engine';

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
  wealth: number;
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
    wealth: row.wealth,
  };
}

async function main(): Promise<void> {
  const prisma = getPrismaClient();
  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  redis.on('error', (err: Error) => {
    console.error(JSON.stringify({ event: 'redis_error', error: err.message }));
  });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  const mockForced = process.env['MOCK_LLM'] === 'true';
  const useMock = mockForced || !apiKey;
  const llmClient = useMock ? new MockLLMClient() : new AnthropicClient(apiKey!);

  if (useMock) {
    console.log(JSON.stringify({
      event: 'llm_mock_mode',
      reason: mockForced ? 'MOCK_LLM=true' : 'ANTHROPIC_API_KEY not set',
    }));
  }

  const queue = createQueue(redisUrl);
  const worker = startWorker(redisUrl, prisma, llmClient);

  worker.on('error', (err: Error) => {
    console.error(JSON.stringify({ event: 'worker_error', error: err.message }));
  });

  const districtCount = await prisma.district.count();
  if (districtCount === 0) {
    await seed(prisma);
  }

  const dbCitizens = await prisma.citizen.findMany({ where: { diedAt: null } });
  const citizens: Citizen[] = dbCitizens.map(row => dbRowToCitizen(row as DbCitizenRow));

  const dbBusinesses = await prisma.business.findMany({ where: { closedAt: null } });
  const businesses: Business[] = dbBusinesses.map(b => ({
    id: b.id,
    name: b.name,
    type: b.type as BusinessType,
    districtId: b.districtId,
    ownerId: b.ownerId,
    openedAt: b.openedAt,
    closedAt: b.closedAt,
    employeeIds: b.employeeIds,
  }));

  const tickState = await loadTickState(redis);

  const relationships = new RelationshipEngine();
  await relationships.load(prisma);

  console.log(JSON.stringify({
    event: 'sim_start',
    citizens: citizens.length,
    tick: tickState.tickNumber,
    relationships: relationships.getCount(),
    llm: useMock ? 'mock' : 'anthropic',
  }));

  const populationEngine = new PopulationEngine();
  const economyEngine = new EconomyEngine();
  startTickEngine(citizens, relationships, prisma, redis, queue, tickState.tickNumber, populationEngine, economyEngine, businesses);
}

main().catch((err: unknown) => {
  console.error(JSON.stringify({
    event: 'fatal',
    error: err instanceof Error ? err.message : String(err),
  }));
  process.exit(1);
});
