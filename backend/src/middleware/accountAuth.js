import prisma from '../config/prisma.js';

const PERMISSION_HIERARCHY = {
  OWNER: 3,
  MANAGER: 2,
  VIEWER: 1,
};

const READ_ONLY_METHODS = ['GET', 'HEAD'];

export function requireAccountPermission(
  requiredLevel = 'VIEWER',
  source = 'params',
  paramKey = 'accountId'
) {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required.',
        });
      }

      // Only administrators have global account access.
      if (user.role === 'ADMIN') {
        return next();
      }

      // Auditors have global read-only access to any account.
      if (user.role === 'AUDITOR') {
        if (READ_ONLY_METHODS.includes(req.method)) {
          return next();
        }
        return res.status(403).json({
          success: false,
          error: 'Auditors have read-only access.',
        });
      }

      const accountId = req[source]?.[paramKey];

      if (
        typeof accountId !== 'string' ||
        accountId.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          error: `Valid account identifier '${paramKey}' is required.`,
        });
      }

      if (!Object.hasOwn(PERMISSION_HIERARCHY, requiredLevel)) {
        return res.status(500).json({
          success: false,
          error: 'Invalid account permission configuration.',
        });
      }

      const permissionRecord =
        await prisma.accountPermission.findUnique({
          where: {
            userId_accountId: {
              userId: user.id,
              accountId,
            },
          },
        });

      if (!permissionRecord) {
        return res.status(403).json({
          success: false,
          error: 'You are not authorized to access this account.',
        });
      }

      const userLevel =
        PERMISSION_HIERARCHY[permissionRecord.permission] || 0;

      const requiredScore =
        PERMISSION_HIERARCHY[requiredLevel];

      if (userLevel < requiredScore) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient account permissions.',
        });
      }

      req.accountPermission = permissionRecord;

      return next();
    } catch (error) {
      return next(error);
    }
  };
}