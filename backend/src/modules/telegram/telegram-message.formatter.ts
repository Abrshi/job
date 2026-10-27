import { Job, WorkArrangement, EmploymentType, ExperienceLevel, SalaryPeriod } from '@prisma/client';

export function escapeTelegramHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function formatWorkArrangement(arrangement?: WorkArrangement | string | null, isRemote?: boolean): string {
  if (arrangement === 'REMOTE' || isRemote) return 'Remote';
  if (arrangement === 'HYBRID' || (typeof arrangement === 'string' && arrangement.toUpperCase().includes('HYBRID'))) return 'Hybrid';
  return 'On-site';
}

function formatEmploymentType(type?: EmploymentType | null): string {
  if (!type) return 'Not specified';
  switch (type) {
    case 'FULL_TIME': return 'Full-time';
    case 'PART_TIME': return 'Part-time';
    case 'CONTRACT': return 'Contract';
    case 'INTERNSHIP': return 'Internship';
    case 'FREELANCE': return 'Freelance';
    default: return String(type);
  }
}

function formatExperienceLevel(level?: ExperienceLevel | null): string | null {
  if (!level || level === 'UNSPECIFIED') return null;
  switch (level) {
    case 'ENTRY': return 'Entry-level';
    case 'JUNIOR': return 'Junior';
    case 'MID': return 'Mid-level';
    case 'SENIOR': return 'Senior';
    case 'LEAD': return 'Lead / Principal';
    case 'EXECUTIVE': return 'Executive / Director';
    default: return String(level);
  }
}

function formatSalary(job: {
  salaryMin?: any;
  salaryMax?: any;
  salaryCurrency?: string | null;
  salaryPeriod?: SalaryPeriod | string | null;
}): string {
  const min = job.salaryMin ? Number(job.salaryMin) : null;
  const max = job.salaryMax ? Number(job.salaryMax) : null;
  const currency = (job.salaryCurrency || 'ETB').toUpperCase();
  const period = job.salaryPeriod ? `/${job.salaryPeriod.toString().toLowerCase()}` : '/month';

  if (min !== null && max !== null && min !== max) {
    return `${min.toLocaleString()} - ${max.toLocaleString()} ${currency}${period}`;
  }
  if (min !== null) {
    return `${min.toLocaleString()} ${currency}${period}`;
  }
  if (max !== null) {
    return `Up to ${max.toLocaleString()} ${currency}${period}`;
  }
  return 'Competitive';
}

function formatLocation(job: { city?: string | null; country?: string | null; location?: string | null }): string {
  if (job.location) return job.location;
  const parts = [job.city, job.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Addis Ababa, Ethiopia';
}

export function formatTelegramJobMessage(job: Partial<Job> & {
  title?: string;
  description?: string;
  originalUrl?: string;
  applicationUrl?: string | null;
  location?: string | null;
  workMode?: string | null;
}): string {
  const rawTitle = (job.normalizedTitle || job.title || job.originalTitle || 'Career Opportunity').trim();
  const title = escapeTelegramHtml(rawTitle.toUpperCase());

  const company = escapeTelegramHtml((job.companyName || 'Confidential Employer').trim());
  const salary = escapeTelegramHtml(formatSalary(job));
  const location = escapeTelegramHtml(formatLocation(job));
  const workMode = escapeTelegramHtml(
    formatWorkArrangement(job.workMode || job.workArrangement, job.isRemote)
  );
  const employmentType = escapeTelegramHtml(formatEmploymentType(job.employmentType));
  const experience = job.experienceLevel ? formatExperienceLevel(job.experienceLevel) : null;

  // Clean and prepare summary
  const rawDesc = (
    job.normalizedDescription ||
    job.description ||
    job.originalDescription ||
    (job as any).descriptionSummary ||
    ''
  ).trim();
  const cleanDesc = stripHtml(rawDesc);
  let summary = cleanDesc;
  if (summary.length > 500) {
    summary = summary.slice(0, 497).trim() + '...';
  }
  const escapedSummary = escapeTelegramHtml(summary);

  // Application link: ensure valid URL
  const targetUrl = (
    job.applicationUrl ||
    job.originalUrl ||
    (job as any).sourceUrl ||
    (job as any).canonicalUrl ||
    (job as any).url ||
    ''
  ).trim();
  const validUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
    ? targetUrl
    : 'https://t.me/etjobcollector';

  const escapedUrl = escapeTelegramHtml(validUrl);

  // Construct message segments
  const lines: string[] = [
    `<b>${title}</b>`,
    '',
    `<b>Company:</b> ${company}`,
    `<b>Salary:</b> ${salary}`,
    `<b>Location:</b> ${location}`,
    `<b>Work mode:</b> ${workMode}`,
    `<b>Employment type:</b> ${employmentType}`,
  ];

  if (experience) {
    lines.push(`<b>Experience:</b> ${escapeTelegramHtml(experience)}`);
  }

  lines.push('');
  if (escapedSummary) {
    lines.push(escapedSummary);
    lines.push('');
  }

  lines.push(`<b>Apply here:</b> <a href="${escapedUrl}">View &amp; Apply</a>`);
  lines.push('');
  lines.push('ET Job Collector (@etjobcollector)');

  let message = lines.join('\n');

  // Hard safety limit check (Telegram max is 4096 characters)
  if (message.length > 4000) {
    const overflow = message.length - 3950;
    const truncatedLength = Math.max(100, summary.length - overflow);
    const shortSummary = escapeTelegramHtml(summary.slice(0, truncatedLength) + '...');
    
    // Reconstruct with shortened summary
    const fallbackLines = [
      `<b>${title}</b>`,
      '',
      `<b>Company:</b> ${company}`,
      `<b>Salary:</b> ${salary}`,
      `<b>Location:</b> ${location}`,
      `<b>Work mode:</b> ${workMode}`,
      `<b>Employment type:</b> ${employmentType}`,
      '',
      shortSummary,
      '',
      `<b>Apply here:</b> <a href="${escapedUrl}">View &amp; Apply</a>`,
      '',
      'ET Job Collector (@etjobcollector)',
    ];
    message = fallbackLines.join('\n');
  }

  return message;
}
