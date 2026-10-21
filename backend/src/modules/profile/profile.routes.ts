import { Router } from 'express';
import { getProfile, updateProfile } from './profile.controller';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { UpdateProfileSchema } from './profile.validation';

const router = Router();

router.use(authenticate);

router.get('/', getProfile);
router.patch('/', validate(UpdateProfileSchema), updateProfile);

export default router;
