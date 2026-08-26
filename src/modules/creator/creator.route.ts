import { Router } from 'express';
import { creatorController } from './creator.controller';
import { authMiddleware, optionalAuthMiddleware } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { usernameParamSchema, creatorQuerySchema } from './creator.validation';
import { keyboardPublicQuerySchema } from '../keyboard/keyboard.validation';

const router = Router();

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
