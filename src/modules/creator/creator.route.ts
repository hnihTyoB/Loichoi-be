import { Router } from 'express';
import { creatorController } from './creator.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middlewares/auth.middleware';
import { requirePermission } from '../../middlewares/permission.middleware';
import { validate } from '../../middlewares/validate.middleware';
import {
  usernameParamSchema,
  creatorQuerySchema,
  creatorApplicationQuerySchema,
  rejectCreatorApplicationSchema,
} from './creator.validation';
import { keyboardPublicQuerySchema, userIdParamSchema } from '../keyboard/keyboard.validation';
import { PERMISSIONS } from '../../common/constants/permission.constant';

const router = Router();

// Admin Management Endpoints
router.get(
  '/manage/applications',
  authMiddleware,
  requirePermission(PERMISSIONS.CREATOR_MANAGE),
  validate(creatorApplicationQuerySchema, 'query'),
  creatorController.findApplications,
);

router.post(
  '/manage/applications/:userId/approve',
  authMiddleware,
  requirePermission(PERMISSIONS.CREATOR_MANAGE),
  validate(userIdParamSchema, 'params'),
  creatorController.approveApplication,
);

router.post(
  '/manage/applications/:userId/reject',
  authMiddleware,
  requirePermission(PERMISSIONS.CREATOR_MANAGE),
  validate(userIdParamSchema, 'params'),
  validate(rejectCreatorApplicationSchema),
  creatorController.rejectApplication,
);

router.post(
  '/manage/creators/:userId/revoke',
  authMiddleware,
  requirePermission(PERMISSIONS.CREATOR_MANAGE),
  validate(userIdParamSchema, 'params'),
  creatorController.revokeCreator,
);

router.get(
  '/me/following',
  authMiddleware,
  creatorController.getUserFollowing,
);

router.get(
  '/',
  optionalAuthMiddleware,
  validate(creatorQuerySchema, 'query'),
  creatorController.findPublicList,
);

router.post(
  '/:username/follow',
  authMiddleware,
  validate(usernameParamSchema, 'params'),
  creatorController.toggleFollow,
);

router.get(
  '/:username/themes',
  optionalAuthMiddleware,
  validate(usernameParamSchema, 'params'),
  validate(keyboardPublicQuerySchema, 'query'),
  creatorController.getCreatorThemes,
);

router.get(
  '/:username',
  optionalAuthMiddleware,
  validate(usernameParamSchema, 'params'),
  creatorController.getProfileByUsername,
);

export default router;
