import { Router } from 'express';
import { categoryController } from './category.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  categoryQuerySchema,
} from './category.validation';

const router = Router();

router.get('/', categoryController.findPublicCategories);

router.get(
  '/manage',
  authMiddleware,
  requirePermission(PERMISSIONS.CATEGORY_READ),
  validate(categoryQuerySchema, 'query'),
  categoryController.findAll,
);

router.get(
  '/manage/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.CATEGORY_READ),
  validate(categoryIdParamSchema, 'params'),
  categoryController.findById,
);

router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.CATEGORY_CREATE),
  validate(createCategorySchema),
  categoryController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.CATEGORY_UPDATE),
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategorySchema),
  categoryController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  requirePermission(PERMISSIONS.CATEGORY_DELETE),
  validate(categoryIdParamSchema, 'params'),
  categoryController.delete,
);

export default router;
