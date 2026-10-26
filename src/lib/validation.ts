import { z } from 'zod';
z.config(z.locales.tr());
export function validTckn(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const n = [...value].map(Number),
    odd = n[0] + n[2] + n[4] + n[6] + n[8],
    even = n[1] + n[3] + n[5] + n[7];
  return (
    (((odd * 7 - even) % 10) + 10) % 10 === n[9] &&
    n.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === n[10]
  );
}
export const emailSchema = z
  .email('Geçerli bir e-posta adresi girin.')
  .max(254)
  .transform((v) => v.trim().toLowerCase());
export const passwordSchema = z
  .string()
  .min(12, 'Şifre en az 12 karakter olmalı.')
  .max(128, 'Şifre en çok 128 karakter olabilir.');
const name = z.string().trim().min(2).max(80);
export const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    email: emailSchema,
    tckn: z.string().refine(validTckn, 'TC kimlik numarasını kontrol edin.'),
    password: passwordSchema,
    confirmPassword: z.string(),
    privacy: z.literal(true, { error: 'Aydınlatma metnini okuduğunuzu onaylayın.' }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Şifreler eşleşmiyor.',
  });
export const loginSchema = z.object({
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
  remember: z.boolean().default(false),
});
export const classSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(1000).default(''),
});
export const scheduleSchema = z
  .object({
    classId: z.string().min(1),
    teacherId: z.string().min(1),
    subjectId: z.string().min(1),
    classroomId: z.string().min(1),
    day: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((v) => v.endMinute > v.startMinute, {
    message: 'Bitiş saati başlangıçtan sonra olmalı.',
  });
export function calculateNet(correct: number, wrong: number, blank: number, limit: number) {
  if (
    ![correct, wrong, blank, limit].every((v) => Number.isInteger(v) && v >= 0) ||
    limit < 1 ||
    correct + wrong + blank > limit
  )
    throw new Error('Doğru, yanlış ve boş sayıları soru sınırını aşamaz.');
  return correct - wrong / 4;
}
export const resultSchema = z.object({
  examId: z.string(),
  studentId: z.string(),
  subjects: z
    .array(
      z.object({
        templateSubjectId: z.string(),
        correct: z.number().int().min(0),
        wrong: z.number().int().min(0),
        blank: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(30),
});
export const assignmentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).default(''),
  subjectId: z.string(),
  classId: z.string(),
  dueAt: z.iso.datetime(),
});
export const announcementSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(2).max(10000),
    audience: z.enum(['ALL', 'STUDENTS', 'TEACHERS', 'CLASSES']),
    classIds: z.array(z.string()).max(100).default([]),
  })
  .refine((v) => v.audience !== 'CLASSES' || v.classIds.length > 0, {
    message: 'En az bir sınıf seçin.',
  });
export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(150),
  email: z.union([emailSchema, z.literal('')]),
  phone: z.string().max(40),
  address: z.string().max(500),
  academicYear: z.string().min(4).max(30),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat('tr', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, 'Geçerli IANA saat dilimi girin.'),
});
