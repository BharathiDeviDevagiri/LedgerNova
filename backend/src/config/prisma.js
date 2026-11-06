import { PrismaClient } from '@prisma/client';

// Configure JSON serialization for BigInt values (paise)
// Standard JavaScript JSON.stringify throws a TypeError on BigInt without this monkey-patch.
BigInt.prototype.toJSON = function () {
  return this.toString();
};

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export default prisma;
