const prisma = require('../../config/database');
const logger = require('../../config/logger');
const { Prisma } = require('@prisma/client');
const { ensureWelcomeBonus } = require('../wallet/wallet.service');

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

async function validateSelection({ matchId, oddsId }) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) throw Object.assign(new Error('Match introuvable'), { status: 404 });
  if (match.status !== 'SCHEDULED') {
    throw Object.assign(new Error('Les paris sont fermés pour ce match'), { status: 400 });
  }
  if (new Date() >= new Date(match.kickoffTime)) {
    throw Object.assign(new Error('Le match a déjà commencé'), { status: 400 });
  }

  const oddsRecord = await prisma.odds.findUnique({ where: { id: oddsId } });
  if (!oddsRecord || oddsRecord.matchId !== matchId) {
    throw Object.assign(new Error('Sélection de cote invalide'), { status: 400 });
  }
  if (oddsRecord.isLocked) {
    throw Object.assign(new Error('Les cotes sont verrouillées'), { status: 400 });
  }

  return { match, oddsRecord };
}

async function placeBet(userId, { matchId, oddsId, stakeAmount }) {
  const { match, oddsRecord } = await validateSelection({ matchId, oddsId });

  await ensureWelcomeBonus(userId);

  // --- Wallet check ---
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Object.assign(new Error('Portefeuille introuvable'), { status: 404 });
  if (parseFloat(wallet.balance) < stakeAmount) {
    throw Object.assign(new Error('Solde insuffisant'), { status: 400 });
  }

  const oddsValue = parseFloat(oddsRecord.odds);
  const potentialWin = roundMoney(stakeAmount * oddsValue);
  const newBalance = parseFloat(wallet.balance) - stakeAmount;

  // --- Atomic transaction ---
  const [bet] = await prisma.$transaction([
    prisma.bet.create({
      data: {
        userId,
        matchId,
        oddsId,
        marketType: oddsRecord.marketType,
        selectedOption: oddsRecord.selection,
        oddsAtPlacement: oddsRecord.odds,
        stakeAmount,
        potentialWin,
      },
    }),
    prisma.wallet.update({
      where: { userId },
      data: { balance: newBalance },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: 'BET_PLACED',
        amount: -stakeAmount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `Bet on ${match.homeTeam} vs ${match.awayTeam} — ${oddsRecord.marketType}`,
      },
    }),
  ]);

  logger.info(`[Bets] Bet placed — user:${userId} match:${matchId} stake:${stakeAmount}`);
  return bet;
}

async function placeCoupon(userId, { selections, stakeAmount }) {
  const uniqueMatchIds = new Set(selections.map(selection => selection.matchId));
  if (selections.length < 2) {
    throw Object.assign(new Error('Un coupon combiné nécessite au moins 2 sélections'), { status: 400 });
  }
  if (uniqueMatchIds.size !== selections.length) {
    throw Object.assign(new Error('Un coupon combiné accepte une seule sélection par match'), { status: 400 });
  }

  await ensureWelcomeBonus(userId);

  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw Object.assign(new Error('Portefeuille introuvable'), { status: 404 });
  if (parseFloat(wallet.balance) < stakeAmount) {
    throw Object.assign(new Error('Solde insuffisant'), { status: 400 });
  }

  const validatedSelections = [];
  let totalOdds = new Prisma.Decimal(1);

  for (const selection of selections) {
    const { match, oddsRecord } = await validateSelection(selection);
    totalOdds = totalOdds.mul(oddsRecord.odds);
    validatedSelections.push({
      matchId: match.id,
      oddsId: oddsRecord.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickoffTime: match.kickoffTime,
      competition: match.competition,
      marketType: oddsRecord.marketType,
      selectedOption: oddsRecord.selection,
      oddsAtPlacement: oddsRecord.odds.toString(),
    });
  }

  const roundedTotalOdds = totalOdds.toDecimalPlaces(4);
  const potentialWin = new Prisma.Decimal(stakeAmount).mul(roundedTotalOdds).toDecimalPlaces(2);
  const newBalance = roundMoney(parseFloat(wallet.balance) - stakeAmount);

  const coupon = await prisma.$transaction(async (tx) => {
    const createdCoupon = await tx.betCoupon.create({
      data: {
        userId,
        selections: validatedSelections,
        selectionCount: validatedSelections.length,
        totalOdds: roundedTotalOdds,
        stakeAmount,
        potentialWin,
      },
    });

    await tx.wallet.update({
      where: { userId },
      data: { balance: newBalance },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: 'BET_PLACED',
        amount: -stakeAmount,
        balanceBefore: wallet.balance,
        balanceAfter: newBalance,
        description: `Coupon combiné ${validatedSelections.length} sélections — cote ${roundedTotalOdds.toFixed(2)}`,
        referenceId: createdCoupon.id,
      },
    });

    return createdCoupon;
  });

  logger.info(`[Bets] Coupon placed — user:${userId} selections:${validatedSelections.length} stake:${stakeAmount} odds:${roundedTotalOdds.toString()}`);
  return coupon;
}

async function getUserBets(userId, { page = 1, limit = 20 } = {}) {
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (currentPage - 1) * pageSize;

  const [bets, coupons, betTotal, couponTotal] = await Promise.all([
    prisma.bet.findMany({
      where: { userId },
      include: { match: true, oddsRecord: true },
      orderBy: { placedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.betCoupon.findMany({
      where: { userId },
      orderBy: { placedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.bet.count({ where: { userId } }),
    prisma.betCoupon.count({ where: { userId } }),
  ]);
  return {
    bets,
    coupons,
    total: betTotal + couponTotal,
    betTotal,
    couponTotal,
    page: currentPage,
    pages: Math.ceil((betTotal + couponTotal) / pageSize),
  };
}

async function getBetById(betId, userId) {
  const bet = await prisma.bet.findFirst({
    where: { id: betId, userId },
    include: { match: true, oddsRecord: true, settlement: true },
  });
  if (bet) {
    return { type: 'single', bet };
  }

  const coupon = await prisma.betCoupon.findFirst({
    where: { id: betId, userId },
  });
  if (coupon) {
    return { type: 'coupon', coupon };
  }

  throw Object.assign(new Error('Bet not found'), { status: 404 });
}

module.exports = { placeBet, placeCoupon, getUserBets, getBetById };
