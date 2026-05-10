import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { PrismaClient } from '@wixbury/db';
import { NewspaperJob } from './jobs/newspaper-job';
import { HistoricalArchiveJob } from './jobs/historical-archive-job';
import { LLMClient } from './llm/llm-client';
import { logError, logStructured } from './logger';

const QUEUE_NAME = 'wixbury-jobs';

export interface NewspaperEditionJobData {
  weekStart: number;
  weekEnd: number;
  currentTick: number;
}

export interface HistoricalSummaryJobData {
  yearStart: number;
  yearEnd: number;
  simYear: number;
}

function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
  };
}

export function createQueue(redisUrl: string): Queue {
  return new Queue(QUEUE_NAME, { connection: parseRedisUrl(redisUrl) });
}

export function startWorker(
  redisUrl: string,
  prisma: PrismaClient,
  llmClient: LLMClient,
): Worker {
  const redisPublisher = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (job.name === 'generate_newspaper_edition') {
        const data = job.data as NewspaperEditionJobData;
        const newspaperJob = new NewspaperJob(prisma, llmClient, redisPublisher);
        await newspaperJob.run(data.weekStart, data.weekEnd, data.currentTick);
      } else if (job.name === 'generate_historical_summary') {
        const data = job.data as HistoricalSummaryJobData;
        const archiveJob = new HistoricalArchiveJob(prisma, llmClient);
        await archiveJob.run(data.yearStart, data.yearEnd, data.simYear);
      }
    },
    { connection: parseRedisUrl(redisUrl) },
  );

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logError({
      event: 'job_failed',
      jobId: job?.id,
      jobName: job?.name,
      error: err.message,
    });
  });

  worker.on('completed', (job: Job) => {
    logStructured({ event: 'job_completed', jobId: job.id, jobName: job.name });
  });

  return worker;
}
