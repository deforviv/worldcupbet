const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { jwt: jwtConfig } = env;
const prisma = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (env.isDev && token === 'local-admin-token') {
        // In dev mode, map the dev token to a real admin user in the DB.
        // If no admin exists yet, create one and ensure it has a wallet.
        try {
          let adminUser = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: {
              id: true, email: true, username: true, role: true, isActive: true, emailVerified: true, createdAt: true,
            },
          });

          if (!adminUser) {
            const existingAdminEmailUser = await prisma.user.findUnique({
              where: { email: 'admin@worldcupbet.local' },
              select: {
                id: true, email: true, username: true, role: true, isActive: true, emailVerified: true, createdAt: true,
              },
            });

            if (existingAdminEmailUser) {
              await prisma.user.update({
                where: { id: existingAdminEmailUser.id },
                data: { role: 'ADMIN', isActive: true, emailVerified: true },
              });
              adminUser = { ...existingAdminEmailUser, role: 'ADMIN', isActive: true, emailVerified: true };
            }
          }

          if (!adminUser) {
            adminUser = await prisma.user.create({
              data: {
                email: 'admin@worldcupbet.local',
                username: 'Administrator',
                passwordHash: 'dev-admin-token',
                role: 'ADMIN',
                isActive: true,
                emailVerified: true,
              },
              select: {
                id: true, email: true, username: true, role: true, isActive: true, emailVerified: true, createdAt: true,
              },
            });
          }

          try {
            const wallet = await prisma.wallet.findUnique({ where: { userId: adminUser.id } });
            if (!wallet) {
              await prisma.wallet.create({ data: { userId: adminUser.id, balance: 0 } });
            }
          } catch (e) {
            // ignore wallet creation errors in dev mapping
          }

          req.user = adminUser;
          return next();
        } catch (e) {
          req.user = {
            id: 'admin',
            email: 'admin@worldcupbet.local',
            username: 'Administrator',
            role: 'ADMIN',
            isActive: true,
            emailVerified: true,
            createdAt: new Date(),
          };
          return next();
        }
    }

    const payload = jwt.verify(token, jwtConfig.secret);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { auth, adminOnly };
