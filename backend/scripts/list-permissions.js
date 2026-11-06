import 'dotenv/config';
import prisma from '../src/config/prisma.js';

try {
  const permissions = await prisma.accountPermission.findMany({
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          role: true,
        },
      },
      account: {
        select: {
          accountNumber: true,
          name: true,
        },
      },
    },
    orderBy: {
      grantedAt: 'asc',
    },
  });

  console.table(permissions.map((p) => ({
    user: p.user.fullName,
    email: p.user.email,
    role: p.user.role,
    account: p.account.name,
    accountNumber: p.account.accountNumber,
    permission: p.permission,
  })));

  console.log('Total permissions:', permissions.length);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
