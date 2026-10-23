import { Router } from 'express';
import multer from 'multer';
import {
  getProfile,
  updateProfile,
  confirmExtractedProfile,
  addExperience,
  updateExperience,
  deleteExperience,
  addEducation,
  updateEducation,
  deleteEducation,
  addCertification,
  deleteCertification,
  addProject,
  deleteProject,
  addSkill,
  deleteSkill,
  addLanguage,
  deleteLanguage,
  addAchievement,
  deleteAchievement,
  uploadAvatar,
  getAvatarProxy,
  getMyAvatarProxy,
  deleteAvatar,
} from './profile.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import {
  UpdateProfileSchema,
  ExperienceSchema,
  EducationSchema,
  CertificationSchema,
  ProjectSchema,
  SkillSchema,
  LanguageSchema,
  AchievementSchema,
  ConfirmExtractedProfileSchema,
} from './profile.validation';

const router = Router();

// Multer memory storage for avatar uploads (max 5MB)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// PUBLIC Avatar Image Proxy Endpoint (allows HTML <img> tags to load image without auth headers)
router.get('/avatar/:userId', getAvatarProxy);

// All subsequent profile endpoints require authenticated user
router.use(authenticate);

// Profile Avatar management
router.get('/avatar', getMyAvatarProxy);
router.post('/avatar', avatarUpload.any(), uploadAvatar);
router.delete('/avatar', deleteAvatar);

// Profile root
router.get('/', getProfile);
router.patch('/', validate(UpdateProfileSchema), updateProfile);

// Confirm & import extracted CV data
router.post('/confirm-cv', validate(ConfirmExtractedProfileSchema), confirmExtractedProfile);

// Experiences
router.post('/experiences', validate(ExperienceSchema), addExperience);
router.patch('/experiences/:id', updateExperience);
router.delete('/experiences/:id', deleteExperience);

// Educations
router.post('/educations', validate(EducationSchema), addEducation);
router.patch('/educations/:id', updateEducation);
router.delete('/educations/:id', deleteEducation);

// Certifications
router.post('/certifications', validate(CertificationSchema), addCertification);
router.delete('/certifications/:id', deleteCertification);

// Projects
router.post('/projects', validate(ProjectSchema), addProject);
router.delete('/projects/:id', deleteProject);

// Skills
router.post('/skills', validate(SkillSchema), addSkill);
router.delete('/skills/:id', deleteSkill);

// Languages
router.post('/languages', validate(LanguageSchema), addLanguage);
router.delete('/languages/:id', deleteLanguage);

// Achievements
router.post('/achievements', validate(AchievementSchema), addAchievement);
router.delete('/achievements/:id', deleteAchievement);

export default router;
