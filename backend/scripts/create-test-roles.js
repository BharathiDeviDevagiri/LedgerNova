import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

const testUsers = [
  {
    fullName: 'LedgerLine Test Administrator',
    email: 'ledgerline.admin.test@example.com',
    role: 'ADMIN',
  },
  {
    fullName: 'LedgerLine Test Auditor',
    email: 'ledgerline.auditor.test@example.com',
    role: 'AUDITOR',
  },
];

try {
  for (const userData of testUsers) {
    const existing = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: userData.role,
          isActive: true,
        },
      });

      console.log(`Updated existing test user: ${userData.email} (${userData.role})`);
      console.log('Existing password retained.');
      continue;
    }

    const password = crypto.randomBytes(18).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        fullName: userData.fullName,
        email: userData.email,
        passwordHash,
        role: userData.role,
        isActive: true,
      },
    });

    console.log('\nCreated test user:', userData.email);
    console.log('Role:', userData.role);
    console.log('Temporary password:', password);
    console.log('Save this password securely; it will not be shown again.\n');
  }
} catch (error) {
  console.error('Test-user setup failed:', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
