import { db } from '@/lib/db';
import { registerSchema, loginSchema, emailSchema, passwordSchema } from '@/lib/validation';
import { hashPassword, verifyPassword } from '@/lib/security/password';
import { blindIndex, encryptIdentity, randomToken, hashToken } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import { sendLink } from '@/lib/email';
import { AppError } from '@/lib/errors';
import { createSession, Actor } from '@/lib/auth/session';
import { z } from 'zod';
import { safeImage } from './photos';
import { putObject, deleteObject } from '@/lib/storage';
export async function register(input: unknown, ip: string, file?: File) {
  const data = registerSchema.parse(input);
  await rateLimit('register', ip, 12, 3600);
  const photoData = file ? await safeImage(file) : undefined;
  const exists = await db.user.findFirst({
    where: { OR: [{ email: data.email }, { tcIndex: blindIndex(data.tckn) }] },
    select: { id: true },
  });
  const passwordHash = await hashPassword(data.password);
  if (exists) return;
  const token = randomToken(),
    photoKey = photoData ? 'photos/' + randomToken() + '.jpg' : undefined;
  if (photoKey && photoData) await putObject(photoKey, photoData);
  let user;
  try {
    user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        passwordHash,
        tcEncrypted: encryptIdentity(data.tckn),
        tcIndex: blindIndex(data.tckn),
        tcLastTwo: data.tckn.slice(-2),
        privacyAcceptedAt: new Date(),
        student: { create: {} },
        ...(photoKey
          ? { photo: { create: { objectKey: photoKey, contentType: 'image/jpeg' } } }
          : {}),
        verificationTokens: {
          create: {
            targetEmail: data.email,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 86400000),
          },
        },
      },
    });
  } catch (error) {
    if (photoKey) await deleteObject(photoKey).catch(() => undefined);
    throw error;
  }
  await db.auditLog.create({ data: { actorId: user.id, action: 'REGISTER' } });
  await sendLink(data.email, token, 'verify');
}
export async function login(input: unknown, ip: string) {
  const data = loginSchema.parse(input),
    identifier = data.identifier.toLowerCase();
  await rateLimit('login-ip', ip, 50);
  await rateLimit('login-account', identifier, 10);
  const user = await db.user.findUnique({
    where: identifier.includes('@') ? { email: identifier } : { tcIndex: blindIndex(identifier) },
  });
  const valid = await verifyPassword(user?.passwordHash, data.password);
  if (!user || !valid || !user.active || !user.emailVerified)
    throw new AppError(
      401,
      'Giriş yapılamadı. Bilgilerinizi ve e-posta doğrulamanızı kontrol edin.',
    );
  const session = await createSession(user.id, data.remember, user.passwordHash);
  await db.auditLog.create({ data: { actorId: user.id, action: 'LOGIN' } });
  return { ...session, role: user.role, remember: data.remember };
}
export async function resendVerification(input: unknown, ip: string) {
  const { email } = z.object({ email: emailSchema }).parse(input);
  await rateLimit('resend-ip', ip, 10, 3600);
  await rateLimit('resend-email', email, 3, 3600);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.emailVerified || !user.active) return;
  const token = randomToken();
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId: user.id } }),
    db.emailVerificationToken.create({
      data: {
        userId: user.id,
        targetEmail: email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 86400000),
      },
    }),
  ]);
  await sendLink(email, token, 'verify');
}
export async function verifyEmail(input: unknown) {
  const { token } = z.object({ token: z.string().min(30).max(100) }).parse(input);
  await db.$transaction(async (tx) => {
    const row = await tx.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!row || row.expiresAt < new Date())
      throw new AppError(400, 'Bağlantı geçersiz veya süresi dolmuş.');
    const consumed = await tx.emailVerificationToken.deleteMany({
      where: { id: row.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw new AppError(400, 'Bağlantı daha önce kullanılmış.');
    await tx.user.update({
      where: { id: row.userId },
      data: { email: row.targetEmail, emailVerified: new Date() },
    });
    await tx.emailVerificationToken.deleteMany({ where: { userId: row.userId } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    await tx.auditLog.create({ data: { actorId: row.userId, action: 'EMAIL_VERIFIED' } });
  });
}
export async function requestReset(input: unknown, ip: string) {
  const { email } = z.object({ email: emailSchema }).parse(input);
  await rateLimit('reset-ip', ip, 10, 3600);
  await rateLimit('reset-email', email, 3, 3600);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) return;
  const token = randomToken();
  await db.$transaction([
    db.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    }),
  ]);
  await sendLink(email, token, 'reset');
}
export async function resetPassword(input: unknown) {
  const { token, password, confirmPassword } = z
    .object({
      token: z.string().min(30).max(100),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .parse(input);
  if (password !== confirmPassword) throw new AppError(400, 'Şifreler eşleşmiyor.');
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.expiresAt < new Date())
      throw new AppError(400, 'Bağlantı geçersiz veya süresi dolmuş.');
    const consumed = await tx.passwordResetToken.deleteMany({
      where: { id: row.id, expiresAt: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw new AppError(400, 'Bağlantı daha önce kullanılmış.');
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    await tx.auditLog.create({ data: { actorId: row.userId, action: 'PASSWORD_RESET' } });
  });
}
export async function changePassword(actor: Actor, input: unknown) {
  const data = z
    .object({
      currentPassword: z.string().max(128),
      password: passwordSchema,
      confirmPassword: z.string(),
    })
    .parse(input);
  if (data.password !== data.confirmPassword) throw new AppError(400, 'Şifreler eşleşmiyor.');
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(user.passwordHash, data.currentPassword)))
    throw new AppError(400, 'Mevcut şifre hatalı.');
  await db.$transaction([
    db.user.update({
      where: { id: actor.id },
      data: { passwordHash: await hashPassword(data.password) },
    }),
    db.session.deleteMany({ where: { userId: actor.id } }),
    db.auditLog.create({ data: { actorId: actor.id, action: 'PASSWORD_CHANGED' } }),
  ]);
}
export async function changeEmail(actor: Actor, input: unknown) {
  const { email, password } = z
    .object({ email: emailSchema, password: z.string().max(128) })
    .parse(input);
  await rateLimit('email-change', actor.id, 3, 3600);
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(user.passwordHash, password)))
    throw new AppError(400, 'Şifre hatalı.');
  if (await db.user.findUnique({ where: { email }, select: { id: true } }))
    throw new AppError(400, 'Bu e-posta adresi kullanılamıyor.');
  const token = randomToken();
  await db.$transaction([
    db.emailVerificationToken.deleteMany({ where: { userId: actor.id } }),
    db.emailVerificationToken.create({
      data: {
        userId: actor.id,
        targetEmail: email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 86400000),
      },
    }),
  ]);
  await sendLink(email, token, 'verify');
}
