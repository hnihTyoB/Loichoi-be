import { Router } from 'express';
import { colorController } from './color.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createColorSchema,
  updateColorSchema,
  colorIdParamSchema,
  colorQuerySchema,
} from './color.validation';

const router = Router();

router.get('/', colorController.findPublicColors);

router.get(
  '/manage',
  authMiddleware,
  requirePermission(PERMISSIONS.COLOR_READ),
  validate(colorQuerySchema, 'query'),
  colorController.findAll,
);

router.get(
  '/manage/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.COLOR_READ),
  validate(colorIdParamSchema, 'params'),
  colorController.findById,
);

router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.COLOR_CREATE),
  validate(createColorSchema),
  colorController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.COLOR_UPDATE),
  validate(colorIdParamSchema, 'params'),
  validate(updateColorSchema),
  colorController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.COLOR_DELETE),
  validate(colorIdParamSchema, 'params'),
  colorController.delete,
);

export default router;
