import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';

const password = process.env.LEDGERLINE_ADMIN_RESET_PASSWORD;

if (!password || password.length < 12) {
  throw new Error('Provide an administrator password of at least 12 characters.');
}

try {
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.update({
    where: { email: 'ledgerline.admin.test@example.com' },
    data: { passwordHash, isActive: true, role: 'ADMIN' },
    select: { email: true, role: true, isActive: true },
  });

  console.log('Administrator password reset successfully.');
  console.log(user);
} catch (error) {
  console.error('Password reset failed:', error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
