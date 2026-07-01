const prisma = require('../../config/database');
const logger = require('../../config/logger');

const WELCOME_BONUS_AMOUNT = 50000;

async function ensureWelcomeBonus(userId) {
  try {
    // Use a lightweight check first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { welcomeBonusClaimed: true, role: true, wallet: { select: { balance: true } } },
    });

    // Admins never receive the welcome bonus
    if (!user || user.welcomeBonusClaimed || !user.wallet || user.role === 'ADMIN') return;

    // Only run transaction if bonus needs to be claimed
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.user.updateMany({
        where: { id: userId, welcomeBonusClaimed: false },
        data: { welcomeBonusClaimed: true },
      });

      if (claimed.count === 0) return;

      const balanceBefore = parseFloat(user.wallet.balance);
      const balanceAfter = balanceBefore + WELCOME_BONUS_AMOUNT;

      await tx.wallet.update({
        where: { userId },
        data: { balance: balanceAfter },
      });

      await tx.transaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount: WELCOME_BONUS_AMOUNT,
          balanceBefore: user.wallet.balance,
          balanceAfter,
          description: 'Bonus de bienvenue WorldCupBet',
          referenceId: 'WELCOME_BONUS',
        },
      });

      logger.info(`[Wallet] Welcome bonus credited — user:${userId} amount:${WELCOME_BONUS_AMOUNT}`);
    });
  } catch (err) {
    // Log but don't fail - welcome bonus is non-critical
    logger.error(`[Wallet] ensureWelcomeBonus failed — user:${userId} err:${err.message}`);
  }
}

async function getWallet(userId) {
  await ensureWelcomeBonus(userId);

  // Parallelize wallet and transactions queries
  const [wallet, transactions] = await Promise.all([
    prisma.wallet.findUnique({
      where: { userId },
      include: {
        user: { select: { username: true, email: true, welcomeBonusClaimed: true } },
      },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 });

  return { wallet, transactions };
}

async function deposit(userId, { amount, method, reference, screenshotUrl }) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 });
  if (!screenshotUrl) {
    throw Object.assign(new Error('Capture de paiement requise'), { status: 400 });
  }

  const depositRequest = await prisma.depositRequest.create({
    data: {
      userId,
      amount,
      method,
      reference,
      screenshotUrl,
      status: 'PENDING',
    },
  });

  logger.info(`[Wallet] Deposit request created — user:${userId} amount:${amount} method:${method}`);
  return {
    message: 'Votre demande de dépôt a été bien reçue et est en attente de validation.',
    depositRequestId: depositRequest.id,
  };
}

async function requestWithdrawal(userId, { amount, method, destination }) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 });
  if (parseFloat(wallet.balance) < amount) {
    throw Object.assign(new Error('Insufficient balance'), { status: 400 });
  }

  // Check no pending withdrawal exists
  const pending = await prisma.withdrawal.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (pending) {
    throw Object.assign(new Error('You already have a pending withdrawal'), { status: 400 });
  }

  const newBalance = parseFloat(wallet.balance) - amount;

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawal.create({ data: { userId, amount, method, destination } }),
    prisma.wallet.update({ where: { userId }, data: { balance: newBalance } }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'WITHDRAWAL',
        amount: -amount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `Withdrawal request via ${method}`,
      },
    }),
  ]);

  logger.info(`[Wallet] Withdrawal request — user:${userId} amount:${amount}`);
  return withdrawal;
}

module.exports = { getWallet, deposit, requestWithdrawal, ensureWelcomeBonus };
