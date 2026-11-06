import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET must be configured and contain at least 32 characters.'
    );
  }

  return secret;
}

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Provide a Bearer token.',
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token is missing.',
      });
    }

    let decoded;

    try {
      decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: ['HS256'],
      });
    } catch {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired authentication token.',
      });
    }

    // Tokens issued by LedgerLine will use userId.
    if (
      !decoded ||
      typeof decoded.userId !== 'string' ||
      !decoded.userId
    ) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token payload.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User account not found.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'User account is deactivated.',
      });
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to perform this action.',
      });
    }

    return next();
  };
}