import { Router } from 'express';
import { keyboardController } from './keyboard.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { createRateLimiter } from '../../middlewares/rate-limit.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createKeyboardSchema,
  updateKeyboardSchema,
  keyboardIdParamSchema,
  userIdParamSchema,
  keyboardSlugParamSchema,
  keyboardPublicQuerySchema,
  keyboardManagementQuerySchema,
} from './keyboard.validation';

const router = Router();

const downloadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 5,
  message: 'Bạn đã thực hiện quá nhiều yêu cầu tải file. Vui lòng thử lại sau 1 phút.',
  keyGenerator: (req) => `download_${req.user?.id || req.ip}`,
});

router.get(
  '/manage',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_READ),
  validate(keyboardManagementQuerySchema, 'query'),
  keyboardController.findManagementList,
);

router.post(
  '/manage/users/:userId/reset-quota',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_UPDATE),
  validate(userIdParamSchema, 'params'),
  keyboardController.resetUserQuota,
);

router.get(
  '/manage/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_READ),
  validate(keyboardIdParamSchema, 'params'),
  keyboardController.findManagementById,
);

router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_CREATE),
  validate(createKeyboardSchema),
  keyboardController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_UPDATE),
  validate(keyboardIdParamSchema, 'params'),
  validate(updateKeyboardSchema),
  keyboardController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.KEYBOARD_DELETE),
  validate(keyboardIdParamSchema, 'params'),
  keyboardController.delete,
);

router.get(
  '/',
  validate(keyboardPublicQuerySchema, 'query'),
  keyboardController.findPublicList,
);

router.post(
  '/:slug/download',
  authMiddleware,
  downloadRateLimiter,
  validate(keyboardSlugParamSchema, 'params'),
  keyboardController.download,
);

router.get(
  '/:slug',
  validate(keyboardSlugParamSchema, 'params'),
  keyboardController.findPublicBySlug,
);

export default router;
