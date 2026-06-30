const prisma = require('./src/config/database');
(async () => {
  try {
    const match = await prisma.match.findFirst({
      where: { status: 'SCHEDULED' },
      include: { odds: { take: 10 } },
    });
    if (!match) {
      console.log('MATCH NOT FOUND');
    } else {
      console.log(JSON.stringify({
        id: match.id,
        externalId: match.externalId,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        kickoffTime: match.kickoffTime,
        odds: match.odds.map(o => ({ id: o.id, marketType: o.marketType, selection: o.selection, odds: String(o.odds), isLocked: o.isLocked }))
      }, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
})();
