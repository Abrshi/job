import crypto from 'crypto';

export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = '';

    // Strip common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'source', 'fbclid', 'gclid'];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Lowercase hostname and remove trailing slash from pathname if present
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ''}${cleanPath}${parsed.search}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

export function generateJobFingerprint(params: {
  externalId?: string | null;
  originalUrl?: string | null;
  title: string;
  companyName?: string | null;
  descriptionSnippet?: string | null;
}): string {
  if (params.externalId && params.externalId.trim().length > 0) {
    return `ext:${params.externalId.trim()}`;
  }

  if (params.originalUrl && params.originalUrl.trim().length > 0) {
    const cleanUrl = normalizeUrl(params.originalUrl);
    const hash = crypto.createHash('sha256').update(cleanUrl).digest('hex').slice(0, 32);
    return `url:${hash}`;
  }

  const cleanTitle = (params.title || '').trim().toLowerCase();
  const cleanCompany = (params.companyName || '').trim().toLowerCase();
  const cleanSnippet = (params.descriptionSnippet || '').trim().toLowerCase().slice(0, 150);

  const contentStr = `${cleanTitle}|${cleanCompany}|${cleanSnippet}`;
  const hash = crypto.createHash('sha256').update(contentStr).digest('hex').slice(0, 32);
  return `content:${hash}`;
}
