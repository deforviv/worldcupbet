const prisma = require('../config/database');

const audit = (action, entity = null) => async (req, res, next) => {
  res.on('finish', async () => {
    try {
      if (res.statusCode < 400) {
        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            action,
            entity,
            entityId: req.params?.id || null,
            metadata: { method: req.method, path: req.path, body: sanitizeBody(req.body) },
            ipAddress: req.ip,
          },
        });
      }
    } catch (e) {
      // Audit log failure must never crash the app
    }
  });
  next();
};

function sanitizeBody(body) {
  if (!body) return null;
  const { password, passwordHash, ...safe } = body;
  return safe;
}

module.exports = { audit };
