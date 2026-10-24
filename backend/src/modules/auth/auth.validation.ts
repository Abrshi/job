import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(100, 'Password must not exceed 100 characters'),
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().min(1).max(50).optional(),
    role: z.enum(['CANDIDATE', 'EMPLOYER']).optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
  cookies: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});

export const verifyEmailSchema = z.object({
  query: z
    .object({
      token: z.string().optional(),
      code: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  body: z
    .object({
      token: z.string().optional(),
      code: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email address is required'),
  }),
});


