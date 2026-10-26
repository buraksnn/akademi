import { cookies } from 'next/headers';
import { unsealSessionToken } from './cookie';
import { db } from '@/lib/db';
import { hashToken, randomToken } from '@/lib/security/crypto';
import { AppError } from '@/lib/errors';
export const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-akademi' : 'akademi-session';
export const actorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  active: true,
  emailVerified: true,
  student: { select: { id: true, number: true } },
  teacher: { select: { id: true } },
  photo: { select: { updatedAt: true } },
} as const;
export type Actor = NonNullable<Awaited<ReturnType<typeof sessionActor>>>;
export async function sessionActor(token: string | undefined) {
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: actorSelect } },
  });
  if (
    !session ||
    session.expiresAt < new Date() ||
    !session.user.active ||
    !session.user.emailVerified
  )
    return null;
  return session.user;
}
export async function currentActor() {
  return sessionActor(await unsealSessionToken((await cookies()).get(COOKIE)?.value));
}
export async function requireActor() {
  const actor = await currentActor();
  if (!actor) throw new AppError(401, 'Devam etmek için giriş yapın.');
  return actor;
}
export async function createSession(
  userId: string,
  remember: boolean,
  expectedPasswordHash?: string,
) {
  const token = randomToken(),
    expiresAt = new Date(Date.now() + (remember ? 30 : 1) * 86400000);
  await db.$transaction(async (tx) => {
    const users = await tx.$queryRaw<
      { passwordHash: string; active: boolean; emailVerified: Date | null }[]
    >`SELECT "passwordHash",active,"emailVerified" FROM "User" WHERE id=${userId} FOR UPDATE`;
    const user = users[0];
    if (
      !user ||
      !user.active ||
      !user.emailVerified ||
      (expectedPasswordHash && user.passwordHash !== expectedPasswordHash)
    )
      throw new AppError(401, 'Giriş yapılamadı. Lütfen tekrar deneyin.');
    await tx.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  });
  return { token, expiresAt };
}
export const roleHome = (role: string) =>
  role === 'ADMIN' ? '/yonetim' : role === 'TEACHER' ? '/ogretmen' : '/ogrenci';
