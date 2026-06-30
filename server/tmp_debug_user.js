const prisma = require('./src/config/database');
(async () => {
  try {
    const user = await prisma.user.findFirst({
      where: { username: 'def_1' },
      include: { wallet: true }
    });
    console.log('USER', user ? {
      id: user.id,
      email: user.email,
      username: user.username,
      emailVerified: user.emailVerified,
      wallet: user.wallet ? { balance: String(user.wallet.balance), currency: user.wallet.currency } : null,
    } : 'NOT_FOUND');
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
