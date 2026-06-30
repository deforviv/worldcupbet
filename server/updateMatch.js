const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const match = await prisma.match.findFirst({
    where: { status: 'SCHEDULED' }
  });

  if (match) {
    await prisma.match.update({
      where: { id: match.id },
      data: { status: 'LIVE' }
    });
    console.log('Match updated to LIVE:', match.homeTeam, 'vs', match.awayTeam);
  } else {
    console.log('No SCHEDULED match found.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
