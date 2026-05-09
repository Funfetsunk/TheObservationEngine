import { getPrismaClient, PrismaClient } from '@wixbury/db';

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = getPrismaClient();
  }
  return globalForPrisma.prisma;
}
