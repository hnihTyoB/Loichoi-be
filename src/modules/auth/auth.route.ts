import { Router } from 'express';
import { AuthController } from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { authRateLimitMiddleware } from '../../middlewares/rate-limit.middleware';
import { requireFeatureFlag } from '../../middlewares/feature-flag.middleware';
import { FEATURE_FLAGS } from '../../common/constants/system-config.constant';
import { validate } from '../../middlewares/validate.middleware';
import {
  loginSchema,
  refreshSchema,
  logoutSchema,
  revokeOtherSessionsSchema,
  registerSchema,
  verifyEmailSchema,
  updateProfileSchema,
  updatePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
  sessionIdParamSchema,
  deviceIdParamSchema,
  getAvatarUploadUrlSchema,
  confirmAvatarUploadSchema,
} from './auth.validation';

const router = Router();
const controller = new AuthController();

router.post('/register', authRateLimitMiddleware, validate(registerSchema), controller.register);
router.get('/verify-email', validate(verifyEmailSchema, 'query'), controller.verifyEmail);
router.post('/login', authRateLimitMiddleware, validate(loginSchema), controller.login);
router.get('/me', authMiddleware, controller.me);
router.post('/refresh', validate(refreshSchema), controller.refresh);
router.post('/logout', validate(logoutSchema), controller.logout);
router.put('/profile', authMiddleware, validate(updateProfileSchema), controller.updateProfile);
router.put('/password', authMiddleware, validate(updatePasswordSchema), controller.updatePassword);
router.post('/forgot-password', authRateLimitMiddleware, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', authRateLimitMiddleware, validate(resetPasswordSchema), controller.resetPassword);
router.post('/resend-verification', authRateLimitMiddleware, validate(resendVerificationSchema), controller.resendVerification);

router.get('/sessions', authMiddleware, controller.getSessions);
router.delete('/sessions/:id', authMiddleware, validate(sessionIdParamSchema, 'params'), controller.revokeSession);
router.delete('/sessions', authMiddleware, validate(revokeOtherSessionsSchema), controller.revokeOtherSessions);

router.get('/devices', authMiddleware, controller.getDevices);
router.delete('/devices/:id', authMiddleware, validate(deviceIdParamSchema, 'params'), controller.deleteDevice);


router.post('/avatar/upload-url', authMiddleware, validate(getAvatarUploadUrlSchema), controller.getAvatarUploadUrl);
router.post('/avatar/confirm', authMiddleware, validate(confirmAvatarUploadSchema), controller.confirmAvatarUpload);

router.get('/discord', requireFeatureFlag(FEATURE_FLAGS.DISCORD_LOGIN_ENABLED), controller.discordAuth);
router.get('/discord/callback', requireFeatureFlag(FEATURE_FLAGS.DISCORD_LOGIN_ENABLED), controller.discordCallback);

export default router;
