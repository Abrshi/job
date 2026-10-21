import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import jobsRoutes from '../modules/jobs/jobs.routes';
import profileRoutes from '../modules/profile/profile.routes';
import adminSourcesRoutes from '../modules/sources/sources.routes';
import adminRoutes from '../modules/admin/admin.routes';
import { adminSettingsService } from '../modules/admin/admin.settings.service';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Public branding settings
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await adminSettingsService.getSettings();
    res.status(200).json({ status: 'success', data: { settings } });
  } catch (err) {
    next(err);
  }
});

router.use('/auth', authRoutes);
router.use('/jobs', jobsRoutes);
router.use('/profile', profileRoutes);
router.use('/admin/sources', adminSourcesRoutes);
router.use('/admin', adminRoutes);

export default router;
