import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!client) {
    client = new PrismaClient({ log: ['error', 'warn'] });
  }
  return client;
}

export { PrismaClient } from '@prisma/client';
