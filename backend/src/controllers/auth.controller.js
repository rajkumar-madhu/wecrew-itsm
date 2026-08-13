// ═══════════════════════════════════════════════════════════
// WeCrew ITSM — Auth Controller
// ═══════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { success, error } = require('../utils/helpers');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 min

// POST /api/v1/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return error(res, 'Invalid credentials', 401);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return error(res, 'Account locked. Try again later.', 423);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const update = { loginAttempts: attempts };
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        update.lockedUntil = new Date(Date.now() + LOCK_DURATION);
        update.status = 'LOCKED';
      }
      await prisma.user.update({ where: { id: user.id }, data: update });
      return error(res, 'Invalid credentials', 401);
    }

    if (user.status === 'INACTIVE') return error(res, 'Account deactivated', 403);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Create session
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        token: accessToken, refreshToken, userId: user.id,
        userAgent: req.get('user-agent'), ipAddress: req.ip, expiresAt,
      },
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(), loginAttempts: 0, lockedUntil: null, status: 'ACTIVE' },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Fetch organization info if user belongs to one
    let organization = null;
    if (user.organizationId) {
      organization = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { id: true, name: true, slug: true, environment: true, fqdn: true },
      });
    }

    logger.info(`User logged in: ${user.email} (org: ${organization?.slug || 'none'})`);
    return success(res, {
      accessToken, refreshToken, expiresIn: process.env.JWT_EXPIRY || '15m',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: user.avatar, organizationId: user.organizationId },
      organization,
    });
  } catch (err) { next(err); }
}

// POST /api/v1/auth/signup (Public — self-registration)
async function signup(req, res, next) {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return error(res, 'An account with this email already exists', 409);

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashed, firstName, lastName, phone: phone || null, role: 'VIEWER', status: 'ACTIVE' },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, createdAt: true },
    });

    // Auto-login: generate tokens + session
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { token: accessToken, refreshToken, userId: user.id, userAgent: req.get('user-agent'), ipAddress: req.ip, expiresAt },
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info(`User self-registered: ${email}`);
    return success(res, {
      accessToken, refreshToken, expiresIn: process.env.JWT_EXPIRY || '15m',
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, avatar: null, organizationId: null },
      organization: null,
    }, 201);
  } catch (err) { next(err); }
}

// POST /api/v1/auth/register (Admin only)
async function register(req, res, next) {
  try {
    const { email, password, firstName, lastName, role, phone, department, jobTitle, organizationId } = req.body;
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    // Admin can assign org; default to admin's own org
    const orgId = organizationId || req.user.organizationId || null;
    const user = await prisma.user.create({
      data: { email, password: hashed, firstName, lastName, role: role || 'VIEWER', phone, department, jobTitle, organizationId: orgId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, organizationId: true, createdAt: true },
    });
    logger.info(`User registered: ${email} by ${req.user.email}`);
    return success(res, user, 201);
  } catch (err) { next(err); }
}

// POST /api/v1/auth/refresh
async function refresh(req, res, next) {
  try {
    const token = req.body.refreshToken || req.cookies?.refreshToken;
    if (!token) return error(res, 'Refresh token required', 400);

    const decoded = verifyRefreshToken(token);
    const session = await prisma.session.findFirst({ where: { refreshToken: token, userId: decoded.id } });
    if (!session) return error(res, 'Invalid session', 401);

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.status !== 'ACTIVE') return error(res, 'User inactive', 401);

    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken(user);

    await prisma.session.update({
      where: { id: session.id },
      data: { token: newAccess, refreshToken: newRefresh, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return success(res, { accessToken: newAccess, refreshToken: newRefresh });
  } catch (err) { next(err); }
}

// POST /api/v1/auth/logout
async function logout(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await prisma.session.deleteMany({ where: { token } }).catch(() => {});
    }
    res.clearCookie('refreshToken');
    return success(res, { message: 'Logged out' });
  } catch (err) { next(err); }
}

// GET /api/v1/auth/me
async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        avatar: true, role: true, department: true, jobTitle: true, timezone: true,
        mfaEnabled: true, lastLogin: true, skills: true, organizationId: true, createdAt: true,
        organization: { select: { id: true, name: true, slug: true, environment: true, fqdn: true } },
        teamMembers: { include: { team: { select: { id: true, name: true } } } },
      },
    });
    return success(res, user);
  } catch (err) { next(err); }
}

// PUT /api/v1/auth/me
async function updateProfile(req, res, next) {
  try {
    const { firstName, lastName, phone, timezone, avatar } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName, phone, timezone, avatar },
      select: { id: true, email: true, firstName: true, lastName: true, phone: true, avatar: true, timezone: true },
    });
    return success(res, user);
  } catch (err) { next(err); }
}

// POST /api/v1/auth/change-password
async function changePassword(req, res, next) {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return error(res, 'Current password incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed, passwordChangedAt: new Date() } });
    // Invalidate all sessions
    await prisma.session.deleteMany({ where: { userId: user.id } });
    return success(res, { message: 'Password changed. Please login again.' });
  } catch (err) { next(err); }
}

// GET /api/v1/auth/users
async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 25, search, role, status } = req.query;
    const skip = (Math.max(1, +page) - 1) * +limit;
    const take = Math.min(100, Math.max(1, +limit));

    const tw = req.tenantWhere || {};
    const where = { ...tw };
    if (role && role !== 'ALL') where.role = role;
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, firstName: true, lastName: true,
          role: true, status: true, phone: true, avatar: true,
          department: true, jobTitle: true, timezone: true,
          organizationId: true, lastLogin: true, createdAt: true,
          organization: { select: { id: true, name: true, slug: true, environment: true, fqdn: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / take);
    return success(res, users, 200, {
      total, page: +page, limit: take, totalPages,
      hasNext: +page < totalPages, hasPrev: +page > 1,
    });
  } catch (err) { next(err); }
}

module.exports = { login, signup, register, refresh, logout, getProfile, updateProfile, changePassword, listUsers };
