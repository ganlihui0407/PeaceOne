import { z } from 'zod';

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100),
    email: z.email().max(254),
    password: z.string().min(8).max(72),
    confirmPassword: z.string().min(1).max(72),
    phone: z.string().trim().max(30).optional(),
    role: z.string().min(1),
    currentPosition: z.string().optional(),
    terms: z.literal(true),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(72),
  rememberMe: z.boolean().optional(),
});
