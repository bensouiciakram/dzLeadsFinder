import { z } from 'zod'

const emailRule = z
  .string()
  .trim()
  .min(1, 'common.errors.required')
  .pipe(z.string().email('common.errors.invalid_email'))

export const signupSchema = z.object({
  email: emailRule,
  password: z
    .string()
    .min(1, 'common.errors.required')
    .max(128, 'auth.signup.error_weak_password')
    .refine((value) => [...value].length >= 8, {
      message: 'common.errors.invalid_password',
    }),
})

export type SignupValues = z.infer<typeof signupSchema>

export const verifyEmailSchema = z.object({
  email: emailRule,
})

export type VerifyEmailValues = z.infer<typeof verifyEmailSchema>

export const loginSchema = z.object({
  email: emailRule,
  password: z
    .string()
    .min(1, 'common.errors.required')
    .max(128, 'common.errors.invalid_password')
    .refine((value) => [...value].length >= 8, {
      message: 'common.errors.invalid_password',
    }),
})

export type LoginValues = z.infer<typeof loginSchema>

export const passwordResetSchema = z.object({
  email: emailRule,
})

export type PasswordResetValues = z.infer<typeof passwordResetSchema>

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(1, 'common.errors.required')
      .max(128, 'common.errors.invalid_password')
      .refine((value) => [...value].length >= 8, {
        message: 'common.errors.invalid_password',
      }),
    confirmPassword: z.string().min(1, 'common.errors.required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'common.errors.password_mismatch',
    path: ['confirmPassword'],
  })

export type NewPasswordValues = z.infer<typeof newPasswordSchema>
