import { z } from 'zod';
import net from 'net';

/**
 * Checks whether an IP address belongs to a private, loopback, or link-local range.
 */
export function isPrivateOrReservedIP(ip: string): boolean {
  if (ip === 'localhost' || ip === '::1' || ip === '0.0.0.0') {
    return true;
  }

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 127.0.0.0/8 Loopback
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 Private
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 Private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 Private
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 Link-local (Cloud metadata e.g. AWS/GCP)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) {
      return true;
    }
  }

  return false;
}

/**
 * Validates endpoint URL to prevent Server-Side Request Forgery (SSRF)
 */
export function validateSafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || isPrivateOrReservedIP(hostname)) {
      return false;
    }

    // Disallow internal cloud metadata hostnames
    if (hostname.includes('metadata.google') || hostname.includes('169.254.169.254')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const createSourceSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Source name must be at least 2 characters').max(100),
    slug: z
      .string()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9_-]+$/, 'Slug must only contain lowercase alphanumeric characters, underscores, and dashes'),
    type: z.enum(['API', 'RSS', 'SCRAPER']).default('API'),
    endpointUrl: z
      .string()
      .url('Endpoint must be a valid URL')
      .refine(validateSafeUrl, 'Endpoint URL cannot reference localhost, private IP addresses, or metadata services'),
    isActive: z.boolean().default(true),
    pollingInterval: z
      .number()
      .int()
      .min(5, 'Polling interval must be at least 5 minutes')
      .max(10080, 'Polling interval cannot exceed 10080 minutes (7 days)')
      .default(60),
    headers: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const updateSourceSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    endpointUrl: z
      .string()
      .url()
      .refine(validateSafeUrl, 'Endpoint URL cannot reference localhost or private IP addresses')
      .optional(),
    isActive: z.boolean().optional(),
    pollingInterval: z
      .number()
      .int()
      .min(5, 'Polling interval must be at least 5 minutes')
      .max(10080, 'Polling interval cannot exceed 10080 minutes')
      .optional(),
    headers: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
});

export const listSourcesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
  }),
});
