import { prisma } from '../../lib/prisma';
import { logAdminAction } from './admin.audit';

export interface UpdateSiteSettingsInput {
  siteName: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  supportEmail?: string;
  footerText?: string;
}

export class AdminSettingsService {
  async getSettings() {
    let settings = await prisma.siteSetting.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.siteSetting.create({
        data: {
          id: 'default',
          siteName: 'JobSphere',
          tagline: 'Ethiopia & East Africa Premier Job Aggregation Platform',
          description: 'Discover curated job opportunities aggregated across top portals, direct employers, and verified recruiters.',
          supportEmail: 'support@job.com',
          footerText: '© 2026 JobSphere Aggregation Platform. All rights reserved.',
        },
      });
    }

    return settings;
  }

  async updateSettings(
    data: UpdateSiteSettingsInput,
    admin: { id: string; email: string },
    ipAddress?: string
  ) {
    const updated = await prisma.siteSetting.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        ...data,
      },
      update: {
        ...data,
      },
    });

    await logAdminAction({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SITE_SETTINGS_UPDATE',
      targetType: 'SETTING',
      targetId: 'default',
      details: data,
      ipAddress,
    });

    return updated;
  }
}

export const adminSettingsService = new AdminSettingsService();
