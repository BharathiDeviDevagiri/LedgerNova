import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

const password = process.env.LEDGERLINE_AUDITOR_RESET_PASSWORD;

if (!password || password.length < 12) {
  throw new Error('Provide a password of at least 12 characters.');
}

try {
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { email: 'ledgerline.auditor.test@example.com' },
    data: { passwordHash, isActive: true, role: 'AUDITOR' },
    select: { email: true, role: true, isActive: true },
  });

  console.log('Auditor password reset successfully.');
  console.log(user);
} catch (error) {
  console.error('Password reset failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
