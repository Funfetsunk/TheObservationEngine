import { PrismaClient } from '@wixbury/db';
import { EventType } from '@wixbury/shared';
import { HistoricalArchiveJob } from '../historical-archive-job';
import { MockLLMClient } from '../../llm/mock-llm-client';
import { HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD } from '../../constants';
import { HISTORICAL_ARCHIVE_FIXTURE } from '../../llm/__fixtures__/historical-archive-fixture';

const SUMMARY_ID = 'summary-uuid-1';
const YEAR_START = 1;
const YEAR_END = 8760;
const SIM_YEAR = 1;

function buildEvent(overrides: Partial<{
  id: string;
  type: string;
  significance: number;
  occurredAt: number;
  citizenIds: string[];
  districtId: string | null;
  data: object;
  writtenUp: boolean;
}>): object {
  return {
    id: 'event-1',
    type: EventType.CitizenDied,
    significance: 0.80,
    occurredAt: 100,
    citizenIds: ['citizen-1'],
    districtId: 'district-1',
    data: { citizenName: 'Roy Finch' },
    writtenUp: false,
    ...overrides,
  };
}

function buildMockPrisma(options: {
  events?: object[];
  citizensBornDied?: object[];
  namedCitizens?: object[];
  districts?: object[];
  elections?: object[];
} = {}): PrismaClient {
  const {
    events = [],
    citizensBornDied = [],
    namedCitizens = [],
    districts = [{ id: 'district-1', name: 'Millside' }],
    elections = [],
  } = options;

  return {
    event: {
      findMany: jest.fn().mockResolvedValue(events),
      create: jest.fn().mockResolvedValue({ id: 'year-closed-event-1' }),
    },
    citizen: {
      findMany: jest.fn()
        .mockResolvedValueOnce(citizensBornDied)
        .mockResolvedValueOnce(namedCitizens),
    },
    election: {
      findMany: jest.fn().mockResolvedValue(elections),
    },
    district: {
      findMany: jest.fn().mockResolvedValue(districts),
    },
    historicalSummary: {
      create: jest.fn().mockResolvedValue({ id: SUMMARY_ID, content: HISTORICAL_ARCHIVE_FIXTURE }),
    },
  } as unknown as PrismaClient;
}

describe('HistoricalArchiveJob', () => {
  let mock: MockLLMClient;

  beforeEach(() => {
    mock = new MockLLMClient();
    mock.setFixtureContent(HISTORICAL_ARCHIVE_FIXTURE);
  });

  it('makes exactly one LLM call per run', async () => {
    const prisma = buildMockPrisma({
      events: [buildEvent({})],
      namedCitizens: [{ id: 'citizen-1', name: 'Roy Finch' }],
    });
    const job = new HistoricalArchiveJob(prisma, mock);

    await job.run(YEAR_START, YEAR_END, SIM_YEAR);

    expect(mock.getCallCount()).toBe(1);
  });

  it('sends user prompt with valid JSON containing required payload keys', async () => {
    const prisma = buildMockPrisma({
      events: [buildEvent({})],
      namedCitizens: [{ id: 'citizen-1', name: 'Roy Finch' }],
    });
    const job = new HistoricalArchiveJob(prisma, mock);

    await job.run(YEAR_START, YEAR_END, SIM_YEAR);

    const lastCall = mock.getLastCall();
    expect(lastCall).toBeDefined();

    // Extract JSON from user prompt (after the first line)
    const promptLines = lastCall!.userPrompt.split('\n\n');
    expect(promptLines.length).toBeGreaterThanOrEqual(2);
    const jsonPart = promptLines.slice(1).join('\n\n');
    const payload = JSON.parse(jsonPart) as Record<string, unknown>;

    expect(payload).toHaveProperty('simYear', SIM_YEAR);
    expect(payload).toHaveProperty('events');
    expect(payload).toHaveProperty('births');
    expect(payload).toHaveProperty('deaths');
    expect(payload).toHaveProperty('elections');
    expect(Array.isArray(payload['events'])).toBe(true);
    expect(Array.isArray(payload['births'])).toBe(true);
    expect(Array.isArray(payload['deaths'])).toBe(true);
    expect(Array.isArray(payload['elections'])).toBe(true);
  });

  it('queries events with significance filter at the threshold', async () => {
    const prisma = buildMockPrisma();
    const job = new HistoricalArchiveJob(prisma, mock);

    await job.run(YEAR_START, YEAR_END, SIM_YEAR);

    const eventFindMany = (prisma.event.findMany as jest.Mock);
    expect(eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          significance: { gte: HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD },
          occurredAt: { gte: YEAR_START, lte: YEAR_END },
        }),
      }),
    );
  });

  it('inserts HistoricalSummary with correct simYear, yearStart, yearEnd, and LLM content', async () => {
    const prisma = buildMockPrisma();
    const job = new HistoricalArchiveJob(prisma, mock);

    await job.run(YEAR_START, YEAR_END, SIM_YEAR);

    const histCreate = (prisma.historicalSummary.create as jest.Mock);
    expect(histCreate).toHaveBeenCalledWith({
      data: {
        simYear: SIM_YEAR,
        yearStart: YEAR_START,
        yearEnd: YEAR_END,
        content: HISTORICAL_ARCHIVE_FIXTURE,
      },
    });
  });

  it('writes a YearClosed event to the events table', async () => {
    const prisma = buildMockPrisma();
    const job = new HistoricalArchiveJob(prisma, mock);

    await job.run(YEAR_START, YEAR_END, SIM_YEAR);

    const eventCreate = (prisma.event.create as jest.Mock);
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: EventType.YearClosed,
          occurredAt: YEAR_END,
          data: expect.objectContaining({ simYear: SIM_YEAR, summaryId: SUMMARY_ID }),
        }),
      }),
    );
  });

  it('completes without error when there are no significant events', async () => {
    const prisma = buildMockPrisma({ events: [] });
    const job = new HistoricalArchiveJob(prisma, mock);

    await expect(job.run(YEAR_START, YEAR_END, SIM_YEAR)).resolves.toBeUndefined();
    expect(mock.getCallCount()).toBe(1);
  });

  it('completes without error when events array is empty and payload reflects that', async () => {
    const prisma = buildMockPrisma({ events: [] });
    const job = new HistoricalArchiveJob(prisma, mock);

    await job.run(YEAR_START, YEAR_END, SIM_YEAR);

    const lastCall = mock.getLastCall()!;
    const promptLines = lastCall.userPrompt.split('\n\n');
    const payload = JSON.parse(promptLines.slice(1).join('\n\n')) as Record<string, unknown>;
    expect((payload['events'] as unknown[]).length).toBe(0);
  });

  it('reset() clears call history and restores default fixture content', () => {
    mock.setFixtureContent('custom content');
    void mock.generate('sys', 'usr');
    mock.reset();

    expect(mock.getCallCount()).toBe(0);
    expect(mock.getLastCall()).toBeUndefined();
  });
});
