import { Router } from 'express';
import { studioController } from './studio.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  studioUpdateProfileSchema,
  studioApplySchema,
  studioThemeQuerySchema,
  studioCreateThemeSchema,
  studioUpdateThemeSchema,
} from './studio.validation';
import { keyboardIdParamSchema, getThemeImageUploadUrlSchema } from '../keyboard/keyboard.validation';

const router = Router();

router.post(
  '/upload-url',
  authMiddleware,
  validate(getThemeImageUploadUrlSchema),
  studioController.getImageUploadUrl,
);

router.get(
  '/stats',
  authMiddleware,
  studioController.getDashboardStats,
);

router.get(
  '/themes',
  authMiddleware,
  validate(studioThemeQuerySchema, 'query'),
  studioController.getCreatorThemes,
);

router.post(
  '/themes',
  authMiddleware,
  validate(studioCreateThemeSchema),
  studioController.createTheme,
);

router.patch(
  '/themes/:id',
  authMiddleware,
  validate(keyboardIdParamSchema, 'params'),
  validate(studioUpdateThemeSchema),
  studioController.updateTheme,
);

router.delete(
  '/themes/:id',
  authMiddleware,
  validate(keyboardIdParamSchema, 'params'),
  studioController.deleteTheme,
);

router.put(
  '/profile',
  authMiddleware,
  validate(studioUpdateProfileSchema),
  studioController.updateProfile,
);

router.post(
  '/apply',
  authMiddleware,
  validate(studioApplySchema),
  studioController.applyCreator,
);

export default router;
