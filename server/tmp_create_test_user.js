const bcrypt = require('bcryptjs');
const prisma = require('./src/config/database');

(async () => {
  try {
    const email = 'test+dev@example.com';
    const password = 'Passw0rd!';
    const hash = await bcrypt.hash(password, 12);

    let user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      console.log('User already exists:', { email });
      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      console.log('Wallet balance:', wallet ? String(wallet.balance) : 'no-wallet');
      process.exit(0);
    }

    user = await prisma.user.create({
      data: {
        email,
        username: `dev_${Date.now()}`,
        passwordHash: hash,
        emailVerified: true,
      },
    });

    await prisma.wallet.create({ data: { userId: user.id, balance: 10000 } });

    console.log('Created user:', { email, password });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();