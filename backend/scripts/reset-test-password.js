import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

try {
  const email = 'ledgerline.test1.20261106112419@example.com';
  const password = await rl.question('Enter a NEW test password: ');

  if (password.length < 8) {
    throw new Error('Password must contain at least 8 characters.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await prisma.user.updateMany({
    where: { email },
    data: { passwordHash }
  });

  console.log('Password reset successful:', result.count === 1);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
