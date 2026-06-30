const bcrypt = require('bcryptjs');
const prisma = require('../src/config/database');

async function main() {
  const email = 'test@worldcupbet.local';
  const password = 'Test1234';
  const username = 'testuser';
  const name = 'Test User';

  const passwordHash = await bcrypt.hash(password, 12);
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: 'USER',
        isActive: true,
        emailVerified: true,
      },
    });
    console.log('Created user:', email);
  } else {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, username, isActive: true, emailVerified: true },
    });
    console.log('Updated existing user:', email);
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) {
    await prisma.wallet.create({ data: { userId: user.id, balance: 100000, currency: 'EUR' } });
    console.log('Created wallet with balance 100000 EUR');
  } else {
    await prisma.wallet.update({ where: { userId: user.id }, data: { balance: 100000, currency: 'EUR' } });
    console.log('Reset wallet balance to 100000 EUR');
  }

  console.log(`User credentials: ${email} / ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });