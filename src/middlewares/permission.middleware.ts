import { Request, Response, NextFunction } from 'express';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODE } from '../common/errors/error-code';
import { permissionCacheService } from '../common/services/permission-cache.service';
import { AuthRepository } from '../modules/auth/auth.repository';

const authRepository = new AuthRepository();

/**
 * Trích xuất và giải quyết danh sách quyền (Set<string>) của người dùng từ cache/database.
 */
async function resolveUserPermissions(req: Request): Promise<Set<string>> {
  if (!req.user) {
    throw new AppError('Unauthorized', 401, ERROR_CODE.UNAUTHORIZED);
  }

  let roleId = req.user.roleId;

  // Xác thực trạng thái người dùng trong cơ sở dữ liệu để chống dùng JWT cũ khi bị khóa/hạ quyền
  if (!(req as any).apiKey) {
    const currentUser = await authRepository.findById(req.user.id);
    if (!currentUser || !currentUser.isActive || currentUser.deletedAt) {
      throw new AppError('Tài khoản của bạn đã bị vô hiệu hóa hoặc không tồn tại', 401, ERROR_CODE.UNAUTHORIZED);
    }
    roleId = currentUser.roleId;
    req.user.roleId = roleId;
    if (currentUser.role) {
      req.user.role = currentUser.role.name;
    }
  }

  if (!roleId) {
    throw new AppError('Forbidden: User role not found', 403, ERROR_CODE.FORBIDDEN);
  }

  const userPermissions = await permissionCacheService.getRolePermissions(roleId);

  // If request is authenticated via API Key, intersect role permissions with scoped API Key permissions
  if ((req as any).apiKey && Array.isArray(req.user.permissions)) {
    const apiKeyPermissions = new Set(req.user.permissions);
    const effectivePermissions = new Set<string>();
    for (const perm of userPermissions) {
      if (apiKeyPermissions.has(perm)) {
        effectivePermissions.add(perm);
      }
    }
    req.user.permissions = Array.from(effectivePermissions);
    return effectivePermissions;
  }

  req.user.permissions = Array.from(userPermissions);
  return userPermissions;
}


/**
 * Middleware bắt buộc người dùng phải có TẤT CẢ các quyền được chỉ định.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userPermissions = await resolveUserPermissions(req);

      const hasAllPermissions = requiredPermissions.every((perm) => userPermissions.has(perm));
      if (!hasAllPermissions) {
        next(new AppError('Forbidden: Insufficient permissions', 403, ERROR_CODE.FORBIDDEN));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware bắt buộc người dùng phải có ÍT NHẤT MỘT trong các quyền được chỉ định.
 */
export function requireAnyPermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userPermissions = await resolveUserPermissions(req);

      const hasAny = requiredPermissions.some((perm) => userPermissions.has(perm));
      if (!hasAny) {
        next(new AppError('Forbidden: Insufficient permissions', 403, ERROR_CODE.FORBIDDEN));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
