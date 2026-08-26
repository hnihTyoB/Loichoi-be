import { Router } from 'express';
import { collectionController } from './collection.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { PERMISSIONS } from '../../common/constants/permission.constant';
import {
  createCollectionSchema,
  updateCollectionSchema,
  collectionIdParamSchema,
  collectionSlugParamSchema,
  collectionThemeParamSchema,
  addCollectionThemeSchema,
  collectionQuerySchema,
  collectionManagementQuerySchema,
} from './collection.validation';

const router = Router();

router.get(
  '/manage',
  authMiddleware,
  requirePermission(PERMISSIONS.COLLECTION_READ),
  validate(collectionManagementQuerySchema, 'query'),
  collectionController.findManagementList,
);

router.get(
  '/',
  validate(collectionQuerySchema, 'query'),
  collectionController.findPublicList,
);

router.post(
  '/',
  authMiddleware,
  validate(createCollectionSchema),
  collectionController.create,
);

router.patch(
  '/:id',
  authMiddleware,
  validate(collectionIdParamSchema, 'params'),
  validate(updateCollectionSchema),
  collectionController.update,
);

router.delete(
  '/:id',
  authMiddleware,
  validate(collectionIdParamSchema, 'params'),
  collectionController.delete,
);

router.post(
  '/:id/themes',
  authMiddleware,
  validate(collectionIdParamSchema, 'params'),
  validate(addCollectionThemeSchema),
  collectionController.addTheme,
);

router.delete(
  '/:id/themes/:themeId',
  authMiddleware,
  validate(collectionThemeParamSchema, 'params'),
  collectionController.removeTheme,
);

router.get(
  '/:slug',
  validate(collectionSlugParamSchema, 'params'),
  collectionController.findPublicBySlug,
);

export default router;
