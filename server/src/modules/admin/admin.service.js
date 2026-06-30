const prisma = require('../../config/database');
const { generateAndSaveOdds } = require('../odds/odds.service');
const notificationsService = require('../notifications/notifications.service');
const logger = require('../../config/logger');

async function getMatches({ status, page = 1, limit = 50 }) {
  const where = status ? { status } : {};
  return prisma.match.findMany({
    where,
    orderBy: { kickoffTime: 'asc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

async function getAllBets({ page = 1, limit = 50 }) {
  const [bets, total] = await Promise.all([
    prisma.bet.findMany({
      include: {
        user: { select: { username: true, email: true } },
        match: { select: { homeTeam: true, awayTeam: true } },
      },
      orderBy: { placedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bet.count(),
  ]);
  return { bets, total };
}

async function getAllUsers({ page = 1, limit = 50 }) {
  return prisma.user.findMany({
    select: {
      id: true, email: true, username: true, role: true, isActive: true, createdAt: true,
      wallet: { select: { balance: true, currency: true } },
      _count: { select: { bets: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

async function getPendingWithdrawals() {
  return prisma.withdrawal.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { username: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function getPendingDepositRequests() {
  return prisma.depositRequest.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { username: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

async function updateDepositRequest(id, { status, adminNote }) {
  const request = await prisma.depositRequest.findUnique({ where: { id } });
  if (!request) throw Object.assign(new Error('Deposit request not found'), { status: 404 });
  if (request.status !== 'PENDING') {
    throw Object.assign(new Error('Deposit request already processed'), { status: 400 });
  }

  const updates = { status, adminNote, processedAt: new Date() };
  if (status === 'APPROVED') {
    const wallet = await prisma.wallet.findUnique({ where: { userId: request.userId } });
    if (!wallet) throw Object.assign(new Error('Wallet not found'), { status: 404 });

    const newBalance = parseFloat(wallet.balance) + parseFloat(request.amount);
    await prisma.$transaction([
      prisma.depositRequest.update({ where: { id }, data: updates }),
      prisma.wallet.update({ where: { userId: request.userId }, data: { balance: newBalance } }),
      prisma.transaction.create({
        data: {
          userId: request.userId,
          type: 'DEPOSIT',
          amount: request.amount,
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          description: 'Dépôt approuvé par l\'administrateur',
          referenceId: id,
        },
      }),
    ]);

    await notificationsService.createNotification(request.userId, {
      title: 'Dépôt approuvé',
      message: `Votre dépôt de ${request.amount} € a été approuvé et votre solde a été crédité.`, 
    });

    return { message: 'Deposit request approved and balance updated' };
  }

  const updatedRequest = await prisma.depositRequest.update({ where: { id }, data: updates });

  await notificationsService.createNotification(request.userId, {
    title: 'Dépôt refusé',
    message: `Votre dépôt de ${request.amount} € a été refusé. Contactez le support si nécessaire.`, 
  });

  return updatedRequest;
}

async function updateWithdrawal(id, { status, adminNote }) {
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
  if (!withdrawal) throw Object.assign(new Error('Withdrawal not found'), { status: 404 });

  const updates = { status, adminNote, processedAt: new Date() };

  // If rejecting, refund the balance
  if (status === 'REJECTED' && withdrawal.status === 'PENDING') {
    const wallet = await prisma.wallet.findUnique({ where: { userId: withdrawal.userId } });
    const newBalance = parseFloat(wallet.balance) + parseFloat(withdrawal.amount);
    await prisma.$transaction([
      prisma.withdrawal.update({ where: { id }, data: updates }),
      prisma.wallet.update({ where: { userId: withdrawal.userId }, data: { balance: newBalance } }),
      prisma.transaction.create({
        data: {
          userId: withdrawal.userId,
          type: 'BET_REFUND',
          amount: parseFloat(withdrawal.amount),
          balanceBefore: wallet.balance,
          balanceAfter: newBalance,
          description: 'Withdrawal rejected — funds returned',
          referenceId: id,
        },
      }),
    ]);
    return { message: 'Withdrawal rejected and funds refunded' };
  }

  return prisma.withdrawal.update({ where: { id }, data: updates });
}

async function getSettlementLogs({ page = 1, limit = 50 }) {
  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      include: {
        match: { select: { homeTeam: true, awayTeam: true, homeScore: true, awayScore: true } },
        bet: { select: { userId: true, marketType: true, selectedOption: true, stakeAmount: true } },
      },
      orderBy: { settledAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.settlement.count(),
  ]);
  return { settlements, total };
}

async function forceRecalcOdds(matchId) {
  return generateAndSaveOdds(matchId);
}

module.exports = {
  getMatches,
  getAllBets,
  getAllUsers,
  getPendingWithdrawals,
  getPendingDepositRequests,
  updateWithdrawal,
  updateDepositRequest,
  getSettlementLogs,
  forceRecalcOdds,
};
