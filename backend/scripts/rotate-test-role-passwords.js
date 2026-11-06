import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

const users = [
  'ledgerline.admin.test@example.com',
  'ledgerline.auditor.test@example.com',
];

try {
  for (const email of users) {
    const password = crypto.randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    console.log('\nEmail:', email);
    console.log('New password:', password);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
