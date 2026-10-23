import { z } from 'zod';
import { UserRole } from '../enums/role.enum';

/**
 * Login Request Schema
 */
export const LoginRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Register Request Schema
 */
export const RegisterRequestSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  department: z.string().optional(),
  role: z.nativeEnum(UserRole).optional().default(UserRole.EMPLOYEE),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * TODO: Reserved for future Email Verification module
 */
export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

/**
 * Auth Token Response Schema
 */
export const AuthResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer').default('Bearer'),
  expiresIn: z.string().or(z.number()),
  user: z.object({
    id: z.string(),
    email: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    role: z.nativeEnum(UserRole),
    department: z.string().nullable().optional(),
    isEmailVerified: z.boolean().default(false),
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
