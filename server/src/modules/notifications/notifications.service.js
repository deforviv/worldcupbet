const prisma = require('../../config/database');

async function getUnreadNotificationsCount(userId) {
  if (prisma.userNotification?.count) {
    return prisma.userNotification.count({ where: { userId, isRead: false } });
  }

  const result = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "notifications"
    WHERE "userId" = ${userId} AND "isRead" = false
  `;

  return Array.isArray(result) && result[0] ? result[0].count || 0 : 0;
}

async function getNotifications(userId, { page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;

  if (prisma.userNotification?.findMany) {
    return prisma.userNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  return prisma.$queryRaw`
    SELECT *
    FROM "notifications"
    WHERE "userId" = ${userId}
    ORDER BY "createdAt" DESC
    OFFSET ${skip}
    LIMIT ${limit}
  `;
}

async function markAllNotificationsRead(userId) {
  if (prisma.userNotification?.updateMany) {
    await prisma.userNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return;
  }

  await prisma.$executeRaw`
    UPDATE "notifications"
    SET "isRead" = true
    WHERE "userId" = ${userId} AND "isRead" = false
  `;
}

async function createNotification(userId, { title, message }) {
  if (prisma.userNotification?.create) {
    return prisma.userNotification.create({
      data: { userId, title, message },
    });
  }

  await prisma.$executeRaw`
    INSERT INTO "notifications" ("userId", "title", "message", "isRead", "createdAt", "updatedAt")
    VALUES (${userId}, ${title}, ${message}, false, NOW(), NOW())
  `;

  return { userId, title, message, isRead: false };
}

module.exports = {
  getUnreadNotificationsCount,
  getNotifications,
  markAllNotificationsRead,
  createNotification,
};
