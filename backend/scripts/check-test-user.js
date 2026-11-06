import 'dotenv/config';
import prisma from '../src/config/prisma.js';

const email = 'ledgerline.test1.20261106112419@example.com';

const user = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    email: true,
    fullName: true,
    role: true,
    isActive: true
  }
});

console.log(user ?? 'USER NOT FOUND');

await prisma.$disconnect();
