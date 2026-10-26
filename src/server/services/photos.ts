import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { db } from '@/lib/db';
import type { Actor } from '@/lib/auth/session';
import { AppError } from '@/lib/errors';
import { canReadUser, admin } from './access';
import { getObject, putObject, deleteObject } from '@/lib/storage';
export async function safeImage(file: File) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    file.size === 0
  )
    throw new AppError(400, 'JPEG, PNG veya WebP seçin. En fazla 5 MB yükleyebilirsiniz.');
  const input = Buffer.from(await file.arrayBuffer());
  const validMagic =
    file.type === 'image/jpeg'
      ? input.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : file.type === 'image/png'
        ? input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : input.toString('ascii', 0, 4) === 'RIFF' && input.toString('ascii', 8, 12) === 'WEBP';
  if (!validMagic) throw new AppError(400, 'Dosya içeriği seçilen görsel türüyle eşleşmiyor.');
  try {
    const image = sharp(input, { limitInputPixels: 25_000_000, animated: false, failOn: 'error' });
    const meta = await image.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages ?? 1) > 1)
      throw new Error('Format');
    return await image
      .rotate()
      .resize({ width: 900, height: 1200, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 86 })
      .toBuffer();
  } catch {
    throw new AppError(400, 'Görsel çözümlenemedi. Geçerli, hareketsiz bir fotoğraf seçin.');
  }
}
export async function savePhoto(actor: Actor, userId: string, file: File) {
  if (actor.id !== userId) admin(actor);
  if (!(await db.user.findUnique({ where: { id: userId }, select: { id: true } })))
    throw new AppError(404, 'Kullanıcı bulunamadı.');
  const data = await safeImage(file),
    key = 'photos/' + randomUUID() + '.jpg';
  await putObject(key, data);
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const old = await tx.profilePhoto.findUnique({ where: { userId } });
      await tx.profilePhoto.upsert({
        where: { userId },
        create: { userId, objectKey: key, contentType: 'image/jpeg' },
        update: { objectKey: key, contentType: 'image/jpeg' },
      });
      if (old) await tx.storageGarbage.create({ data: { objectKey: old.objectKey } });
      await tx.auditLog.create({
        data: { actorId: actor.id, action: 'PHOTO_UPDATED', entityId: userId },
      });
    });
  } catch (error) {
    await deleteObject(key).catch(() => undefined);
    throw error;
  }
}
export async function readPhoto(actor: Actor, userId: string) {
  await canReadUser(actor, userId);
  const photo = await db.profilePhoto.findUnique({ where: { userId } });
  if (!photo) throw new AppError(404, 'Fotoğraf bulunamadı.');
  return getObject(photo.objectKey);
}
export async function removePhoto(actor: Actor, userId: string) {
  if (actor.id !== userId) admin(actor);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const old = await tx.profilePhoto.findUnique({ where: { userId } });
    if (!old) return;
    await tx.profilePhoto.delete({ where: { userId } });
    await tx.storageGarbage.create({ data: { objectKey: old.objectKey } });
    await tx.auditLog.create({
      data: { actorId: actor.id, action: 'PHOTO_REMOVED', entityId: userId },
    });
  });
}
export async function saveLogo(actor: Actor, file: File) {
  admin(actor);
  const data = await safeImage(file),
    key = 'logos/' + randomUUID() + '.jpg';
  await putObject(key, data);
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(66341)`;
      const old = await tx.institutionSettings.findUnique({ where: { id: 'main' } });
      await tx.institutionSettings.upsert({
        where: { id: 'main' },
        create: { id: 'main', logoKey: key },
        update: { logoKey: key },
      });
      if (old?.logoKey) await tx.storageGarbage.create({ data: { objectKey: old.logoKey } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'LOGO_UPDATED' } });
    });
  } catch (error) {
    await deleteObject(key).catch(() => undefined);
    throw error;
  }
}
