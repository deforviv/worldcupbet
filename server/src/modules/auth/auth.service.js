const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const { jwt: jwtConfig, brevo } = require('../../config/env');
const logger = require('../../config/logger');
const { sendVerificationEmail } = require('../../providers/brevo.provider');

function signToken(userId) {
  return jwt.sign({ userId }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId }, jwtConfig.refreshSecret, { expiresIn: jwtConfig.refreshExpiresIn });
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

function authPayload(user) {
  const token = signToken(user.id);
  return {
    user: serializeUser(user),
    token,
    accessToken: token,
    refreshToken: signRefreshToken(user.id),
  };
}

function normalizeUsername(value) {
  const normalized = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);

  return normalized.length >= 3 ? normalized : `user_${Date.now().toString(36)}`;
}

async function buildUniqueUsername({ email, name, username }) {
  const source = username || name || email.split('@')[0];
  const base = normalizeUsername(source);
  let candidate = base;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base.slice(0, 24)}_${suffix}`;
    suffix++;
  }

  return candidate;
}

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getVerificationExpiry() {
  const ttl = Number.isFinite(brevo.verificationCodeTtlMinutes)
    ? brevo.verificationCodeTtlMinutes
    : 10;
  return new Date(Date.now() + ttl * 60 * 1000);
}

async function createAndSendVerificationCode(user, name) {
  const code = generateVerificationCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = getVerificationExpiry();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: new Date(),
    },
  });

  await sendVerificationEmail({
    to: user.email,
    name: name || user.username,
    code,
    expiresInMinutes: brevo.verificationCodeTtlMinutes,
  });
}

async function register({ email, name, username, password }) {
  const emailExists = await prisma.user.findUnique({ where: { email } });
  if (emailExists) {
    throw Object.assign(new Error('Email already taken'), { status: 409 });
  }

  const safeUsername = await buildUniqueUsername({ email, name, username });
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        username: safeUsername,
        passwordHash,
        emailVerified: false,
      },
      select: { id: true, email: true, username: true, role: true, emailVerified: true },
    });

    await tx.wallet.create({ data: { userId: createdUser.id } });
    return createdUser;
  });

  try {
    await createAndSendVerificationCode(user, name);
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    throw err;
  }

  logger.info(`[Auth] New user registered: ${email}`);
  return {
    user,
    verificationRequired: true,
    message: 'Verification code sent',
  };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }
  if (!user.emailVerified) {
    throw Object.assign(new Error('Email verification required'), { status: 403 });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid credentials'), { status: 401 });
  }

  logger.info(`[Auth] User logged in: ${email}`);
  return authPayload(user);
}

async function refreshToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, jwtConfig.refreshSecret);
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found'), { status: 401 });
  }

  const newToken = signToken(user.id);
  return { token: newToken, accessToken: newToken };
}

async function verifyEmail({ email, code }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (user.emailVerified) {
    return authPayload(user);
  }

  if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
    throw Object.assign(new Error('Verification code not found'), { status: 400 });
  }

  if (user.emailVerificationExpiresAt < new Date()) {
    throw Object.assign(new Error('Verification code expired'), { status: 400 });
  }

  const valid = await bcrypt.compare(code, user.emailVerificationCodeHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid verification code'), { status: 400 });
  }

  const verifiedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
      emailVerificationSentAt: null,
    },
  });

  logger.info(`[Auth] User email verified: ${email}`);
  return authPayload(verifiedUser);
}

async function resendVerificationCode({ email }) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  if (user.emailVerified) {
    return { message: 'Email already verified' };
  }

  await createAndSendVerificationCode(user);
  return { message: 'Verification code sent' };
}

async function updateProfile(userId, { username, email }) {
  const updateData = {};

  if (username) {
    const normalized = normalizeUsername(username);
    const existing = await prisma.user.findFirst({
      where: { username: normalized, id: { not: userId } },
    });
    if (existing) {
      throw Object.assign(new Error('Username already taken'), { status: 409 });
    }
    updateData.username = normalized;
  }

  if (email) {
    const normalizedEmail = email.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: { email: normalizedEmail, id: { not: userId } },
    });
    if (existing) {
      throw Object.assign(new Error('Email already taken'), { status: 409 });
    }
    updateData.email = normalizedEmail;
  }

  if (Object.keys(updateData).length === 0) {
    throw Object.assign(new Error('No profile fields to update'), { status: 400 });
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      emailVerified: true,
    },
  });

  logger.info(`[Auth] User profile updated: ${userId}`);
  return updatedUser;
}

module.exports = { register, login, refreshToken, verifyEmail, resendVerificationCode, updateProfile };
