import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import jobsRoutes from '../modules/jobs/jobs.routes';
import applicationsRoutes from '../modules/applications/applications.routes';
import profileRoutes from '../modules/profile/profile.routes';
import documentsRoutes from '../modules/documents/documents.routes';
import aiDocumentsRoutes from '../modules/ai-documents/ai-documents.routes';
import { savedSearchesRoutes, notificationsRoutes } from '../modules/alerts/alerts.routes';

const router = Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

router.use('/auth', authRoutes);
router.use('/jobs', jobsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/profile', profileRoutes);
router.use('/documents', documentsRoutes);
router.use('/ai-documents', aiDocumentsRoutes);
router.use('/saved-searches', savedSearchesRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
