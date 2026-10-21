import { Router } from 'express';
import { authController } from './auth.controller';
import { registerSchema, loginSchema, refreshTokenSchema } from './auth.validation';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authRateLimiter } from '../../middleware/rate-limit';
import { asyncHandler } from '../../utils/async-handler';

const router = Router();

router.post(
  '/register',
  authRateLimiter,
  validate(registerSchema),
  asyncHandler(authController.register)
);

router.post(
  '/login',
  authRateLimiter,
  validate(loginSchema),
  asyncHandler(authController.login)
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(authController.refresh)
);

router.post(
  '/logout',
  asyncHandler(authController.logout)
);

router.get(
  '/me',
  authenticate,
  asyncHandler(authController.me)
);

export default router;

