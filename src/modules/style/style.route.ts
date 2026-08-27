import { Router } from 'express';
import { styleController } from './style.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createStyleSchema,
  updateStyleSchema,
  styleIdParamSchema,
  styleQuerySchema,
} from './style.validation';

const router = Router();

router.get('/', styleController.findPublicStyles);

router.get(
  '/manage',
  authMiddleware,
  requirePermission(PERMISSIONS.STYLE_READ),
  validate(styleQuerySchema, 'query'),
  styleController.findAll,
);

router.get(
  '/manage/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.STYLE_READ),
  validate(styleIdParamSchema, 'params'),
  styleController.findById,
);

router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.STYLE_CREATE),
  validate(createStyleSchema),
  styleController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.STYLE_UPDATE),
  validate(styleIdParamSchema, 'params'),
  validate(updateStyleSchema),
  styleController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.STYLE_DELETE),
  validate(styleIdParamSchema, 'params'),
  styleController.delete,
);

export default router;
