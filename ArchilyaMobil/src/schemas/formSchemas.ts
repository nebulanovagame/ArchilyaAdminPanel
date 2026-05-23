import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'E-posta adresi zorunludur.'),
  password: z.string().min(1, 'Sifre zorunludur.'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Ad Soyad zorunludur.'),
    email: z.string().min(1, 'E-posta adresi zorunludur.'),
    password: z.string().min(6, 'Sifre en az 6 karakter olmali.'),
    confirmPassword: z.string().min(1, 'Sifre tekrari zorunludur.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Sifreler eslesmiyor.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const projectCreateSchema = z.object({
  name: z.string().min(1, 'Proje adi zorunludur.'),
  location: z.string().optional(),
});

export type ProjectCreateFormValues = z.infer<typeof projectCreateSchema>;
