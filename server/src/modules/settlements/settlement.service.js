/**
 * Settlement Service
 * ──────────────────
 * Runs every 15 minutes via cron job.
 * Finds finished unsettled matches, determines winners, credits wallets.
 */

const prisma = require('../../config/database');
const logger = require('../../config/logger');

// ─── Determine if a bet is won based on market and final score ──────────────
function determineBetResult(bet, homeScore, awayScore) {
  const { marketType, selectedOption } = bet;
  const totalGoals = homeScore + awayScore;

  switch (marketType) {
    case 'HOME_WIN':   return homeScore > awayScore;
    case 'DRAW':       return homeScore === awayScore;
    case 'AWAY_WIN':   return awayScore > homeScore;

    case 'OVER_1_5':   return totalGoals > 1;
    case 'UNDER_1_5':  return totalGoals <= 1;
    case 'OVER_2_5':   return totalGoals > 2;
    case 'UNDER_2_5':  return totalGoals <= 2;
    case 'OVER_3_5':   return totalGoals > 3;
    case 'UNDER_3_5':  return totalGoals <= 3;

    case 'DOUBLE_CHANCE_1X': return homeScore >= awayScore;
    case 'DOUBLE_CHANCE_X2': return awayScore >= homeScore;
    case 'DOUBLE_CHANCE_12': return homeScore !== awayScore;

    case 'CORRECT_SCORE': {
      const [h, a] = selectedOption.split('-').map(Number);
      return h === homeScore && a === awayScore;
    }

    default: return false;
  }
}

// ─── Main settlement runner ──────────────────────────────────────────────────
async function settleCouponRecord(coupon, result, payout) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.betCoupon.update({
        where: { id: coupon.id },
        data: { status: result, settledAt: new Date() },
      });

      if (result === 'WON' && payout > 0) {
        const wallet = await tx.wallet.findUnique({ where: { userId: coupon.userId } });
        if (!wallet) return;

        const newBalance = parseFloat(wallet.balance) + payout;
        await tx.wallet.update({
          where: { userId: coupon.userId },
          data: { balance: newBalance },
        });

        await tx.transaction.create({
          data: {
            userId: coupon.userId,
            type: 'BET_WIN',
            amount: payout,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            description: `Gains coupon combiné (${coupon.selectionCount} matchs) — cote ${parseFloat(coupon.totalOdds).toFixed(2)}`,
            referenceId: coupon.id,
          },
        });
        return;
      }

      if (result === 'REFUNDED' && payout > 0) {
        const wallet = await tx.wallet.findUnique({ where: { userId: coupon.userId } });
        if (!wallet) return;

        const newBalance = parseFloat(wallet.balance) + payout;
        await tx.wallet.update({
          where: { userId: coupon.userId },
          data: { balance: newBalance },
        });

        await tx.transaction.create({
          data: {
            userId: coupon.userId,
            type: 'BET_REFUND',
            amount: payout,
            balanceBefore: wallet.balance,
            balanceAfter: newBalance,
            description: `Remboursement coupon combiné (${coupon.selectionCount} matchs)`,
            referenceId: coupon.id,
          },
        });
      }
    });

    logger.info(`[Settlement] Coupon ${coupon.id} → ${result} | payout: ${payout}`);
  } catch (err) {
    logger.error(`[Settlement] Failed to settle coupon ${coupon.id}`, { error: err.message });
  }
}

async function settleCoupons() {
  const pendingCoupons = await prisma.betCoupon.findMany({
    where: { status: 'PENDING' },
  });

  if (pendingCoupons.length === 0) {
    return;
  }

  logger.info(`[Settlement] Checking ${pendingCoupons.length} pending coupon(s)...`);

  for (const coupon of pendingCoupons) {
    const selections = Array.isArray(coupon.selections) ? coupon.selections : [];
    if (selections.length === 0) continue;

    const matchIds = [...new Set(selections.map(selection => selection.matchId))];
    const matches = await prisma.match.findMany({
      where: { id: { in: matchIds } },
    });
    const matchById = new Map(matches.map(match => [match.id, match]));

    let lost = false;
    let allResolved = true;
    let allWon = true;

    for (const selection of selections) {
      const match = matchById.get(selection.matchId);

      if (!match) {
        allResolved = false;
        allWon = false;
        continue;
      }

      if (match.status === 'CANCELLED') {
        await settleCouponRecord(coupon, 'REFUNDED', parseFloat(coupon.stakeAmount));
        lost = null;
        break;
      }

      if (match.status === 'POSTPONED') {
        allResolved = false;
        allWon = false;
        continue;
      }

      if (match.status !== 'FINISHED' || match.homeScore == null || match.awayScore == null) {
        allResolved = false;
        allWon = false;
        continue;
      }

      const legWon = determineBetResult(
        {
          marketType: selection.marketType,
          selectedOption: selection.selectedOption,
        },
        match.homeScore,
        match.awayScore,
      );

      if (!legWon) {
        lost = true;
        break;
      }
    }

    if (lost === null) {
      continue;
    }

    if (lost) {
      const refundAmount = parseFloat(coupon.stakeAmount) / 2;
      await settleCouponRecord(coupon, 'LOST', refundAmount);
      continue;
    }

    if (allResolved && allWon) {
      await settleCouponRecord(coupon, 'WON', parseFloat(coupon.potentialWin));
    }
  }
}

async function runSettlement() {
  logger.info('[Settlement] Running settlement check...');

  // Find finished matches not yet settled
  const unsettledMatches = await prisma.match.findMany({
    where: {
      status: 'FINISHED',
      settledAt: null,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: {
      bets: {
        where: { status: 'PENDING' },
        include: { user: true },
      },
    },
  });

  if (unsettledMatches.length === 0) {
    logger.info('[Settlement] No unsettled matches found.');
  } else {
    logger.info(`[Settlement] Processing ${unsettledMatches.length} match(es)...`);

    for (const match of unsettledMatches) {
      const { homeScore, awayScore, bets } = match;
      logger.info(`[Settlement] Match: ${match.homeTeam} ${homeScore}-${awayScore} ${match.awayTeam} | ${bets.length} pending bets`);

      for (const bet of bets) {
        const won = determineBetResult(bet, homeScore, awayScore);
        const payout = won ? parseFloat(bet.potentialWin) : 0;
        const result = won ? 'WON' : 'LOST';

        try {
          await prisma.$transaction(async (tx) => {
            // Update bet status
            await tx.bet.update({
              where: { id: bet.id },
              data: { status: result, settledAt: new Date() },
            });

            // Create settlement record
            await tx.settlement.create({
              data: {
                matchId: match.id,
                betId: bet.id,
                settlementResult: result,
                payoutAmount: payout,
              },
            });

            const wallet = await tx.wallet.findUnique({ where: { userId: bet.userId } });
            if (!wallet) return;
            if (won) {
              const newBalance = parseFloat(wallet.balance) + payout;
              await tx.wallet.update({ where: { userId: bet.userId }, data: { balance: newBalance } });
              await tx.transaction.create({
                data: {
                  userId: bet.userId,
                  type: 'BET_WIN',
                  amount: payout,
                  balanceBefore: wallet.balance,
                  balanceAfter: newBalance,
                  description: `Gains: ${match.homeTeam} vs ${match.awayTeam}`,
                  referenceId: bet.id,
                },
              });
            } else {
              const refundAmount = parseFloat(bet.stakeAmount) / 2;
              if (refundAmount > 0) {
                const newBalance = parseFloat(wallet.balance) + refundAmount;
                await tx.wallet.update({ where: { userId: bet.userId }, data: { balance: newBalance } });
                await tx.transaction.create({
                  data: {
                    userId: bet.userId,
                    type: 'BET_REFUND',
                    amount: refundAmount,
                    balanceBefore: wallet.balance,
                    balanceAfter: newBalance,
                    description: `Remboursement partiel (50%) ${match.homeTeam} vs ${match.awayTeam}`,
                    referenceId: bet.id,
                  },
                });
              }
            }
          });

          logger.info(`[Settlement] Bet ${bet.id} → ${result} | payout: ${payout}`);
        } catch (err) {
          logger.error(`[Settlement] Failed to settle bet ${bet.id}`, { error: err.message });
        }
      }

      // Mark match as settled
      await prisma.match.update({
        where: { id: match.id },
        data: { settledAt: new Date() },
      });

      logger.info(`[Settlement] Match ${match.id} fully settled.`);
    }
  }

  await settleCoupons();
}

module.exports = { runSettlement, determineBetResult, settleCoupons };
