import Redis from 'ioredis';

const globalForRedis = globalThis as typeof globalThis & { redis?: Redis };

export function getRedisClient(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
  return globalForRedis.redis;
}
