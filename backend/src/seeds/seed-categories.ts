import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

export const INITIAL_CATEGORIES = [
  {
    name: 'Software & IT',
    slug: 'software-it',
    description: 'Software engineering, DevOps, IT support, QA, cloud architecture, and data engineering',
  },
  {
    name: 'Engineering & Architecture',
    slug: 'engineering-architecture',
    description: 'Civil, electrical, mechanical, structural engineering and architectural design',
  },
  {
    name: 'Healthcare & Medicine',
    slug: 'healthcare-medicine',
    description: 'Clinical medicine, nursing, public health, pharmacy, and healthcare operations',
  },
  {
    name: 'Education & Training',
    slug: 'education-training',
    description: 'Teaching, curriculum development, academia, and professional instruction',
  },
  {
    name: 'Finance & Accounting',
    slug: 'finance-accounting',
    description: 'Accounting, auditing, financial planning, banking, and investment management',
  },
  {
    name: 'Business & Management',
    slug: 'business-management',
    description: 'Executive management, operations oversight, project management, and business strategy',
  },
  {
    name: 'Sales & Business Development',
    slug: 'sales-business-development',
    description: 'Account management, business development, B2B sales, and partnership acquisition',
  },
  {
    name: 'Marketing & Communications',
    slug: 'marketing-communications',
    description: 'Brand strategy, digital marketing, public relations, social media, and content writing',
  },
  {
    name: 'Customer Service & Support',
    slug: 'customer-service-support',
    description: 'Customer success, help desk support, client liaison, and call center operations',
  },
  {
    name: 'Human Resources & Recruitment',
    slug: 'human-resources-recruitment',
    description: 'Talent acquisition, employee relations, people operations, and compensation & benefits',
  },
  {
    name: 'Administration & Office Support',
    slug: 'administration-office-support',
    description: 'Office management, executive administration, front desk, and document control',
  },
  {
    name: 'Legal & Compliance',
    slug: 'legal-compliance',
    description: 'Legal advice, corporate compliance, contract management, and regulatory oversight',
  },
  {
    name: 'Construction & Real Estate',
    slug: 'construction-real-estate',
    description: 'Site management, civil construction, property appraisal, and real estate brokerage',
  },
  {
    name: 'Manufacturing & Industrial',
    slug: 'manufacturing-industrial',
    description: 'Industrial manufacturing, plant operations, quality control, and machinery maintenance',
  },
  {
    name: 'Logistics & Supply Chain',
    slug: 'logistics-supply-chain',
    description: 'Procurement, warehousing, transport logistics, freight forwarding, and inventory control',
  },
  {
    name: 'Agriculture & Environment',
    slug: 'agriculture-environment',
    description: 'Agronomy, horticulture, environmental conservation, sustainable forestry, and agribusiness',
  },
  {
    name: 'Hospitality & Tourism',
    slug: 'hospitality-tourism',
    description: 'Hotel management, culinary arts, food and beverage, tour guiding, and event hosting',
  },
  {
    name: 'Media',
    slug: 'media',
    description: 'Journalism, broadcasting, publishing, mass communication, and audio-visual production',
  },
  {
    name: 'Design & Creative',
    slug: 'design-creative',
    description: 'UI/UX design, graphic arts, visual design, fashion design, and multimedia illustration',
  },
  {
    name: 'Media, Design & Creative',
    slug: 'media-design-creative',
    description: 'UI/UX design, graphic arts, video editing, photography, and creative multimedia',
  },
  {
    name: 'Research & Science',
    slug: 'research-science',
    description: 'Scientific research, laboratory testing, data analytics, and biotechnology development',
  },
  {
    name: 'NGO, Development & Social Services',
    slug: 'ngo-development-social-services',
    description: 'Community development, humanitarian relief, grant administration, and NGO coordination',
  },
];

export async function seedCategories(): Promise<{ seededCount: number; totalCount: number }> {
  let seededCount = 0;

  for (const cat of INITIAL_CATEGORIES) {
    const existing = await prisma.jobCategory.findUnique({
      where: { slug: cat.slug },
    });

    if (!existing) {
      await prisma.jobCategory.create({
        data: {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          isActive: true,
        },
      });
      seededCount++;
    }
  }

  const totalCount = await prisma.jobCategory.count();
  logger.info(`Categories seed complete: ${seededCount} new seeded, total ${totalCount} categories`);
  return { seededCount, totalCount };
}
