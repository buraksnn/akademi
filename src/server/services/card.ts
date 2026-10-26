import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Actor } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { admin } from './access';
import { AppError } from '@/lib/errors';
import { getObject } from '@/lib/storage';
export async function studentCard(actor: Actor, userId: string) {
  admin(actor);
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      student: { include: { enrollments: { where: { active: true }, include: { class: true } } } },
      photo: true,
      role: true,
    },
  });
  if (!user?.student || user.role !== 'STUDENT') throw new AppError(404, 'Öğrenci bulunamadı.');
  const institution = await db.institutionSettings.findUnique({ where: { id: 'main' } });
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(path.join(process.cwd(), 'public/DejaVuSans.ttf')),
    { subset: true },
  );
  const page = pdf.addPage([340, 214]);
  const black = rgb(0.09, 0.09, 0.09),
    muted = rgb(0.45, 0.45, 0.45);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 340,
    height: 214,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.88, 0.88, 0.88),
    borderWidth: 1,
  });
  page.drawRectangle({ x: 0, y: 208, width: 340, height: 6, color: rgb(0.145, 0.388, 0.92) });
  let titleX = 20;
  if (institution?.logoKey) {
    const logo = await pdf.embedJpg(Uint8Array.from(await getObject(institution.logoKey)));
    page.drawImage(logo, { x: 20, y: 162, width: 32, height: 32 });
    titleX = 62;
  }
  const fit = (text: string, max: number, size: number) =>
    Math.min(size, max / font.widthOfTextAtSize(text, 1));
  page.drawText(institution?.name || 'Akademi', {
    x: titleX,
    y: 180,
    size: fit(institution?.name || 'Akademi', 310 - titleX, 15),
    font,
    color: black,
  });
  page.drawText('ÖĞRENCİ KİMLİK KARTI', { x: titleX, y: 164, size: 8, font, color: muted });
  if (user.photo) {
    const photo = await pdf.embedJpg(Uint8Array.from(await getObject(user.photo.objectKey)));
    const ratio = photo.width / photo.height;
    const height = Math.min(103, 78 / ratio),
      width = height * ratio;
    page.drawImage(photo, { x: 20 + (78 - width) / 2, y: 43 + (103 - height) / 2, width, height });
  } else {
    page.drawRectangle({ x: 20, y: 43, width: 78, height: 103, color: rgb(0.96, 0.97, 0.98) });
    page.drawText(user.firstName[0] + user.lastName[0], {
      x: 40,
      y: 85,
      font,
      size: 22,
      color: muted,
    });
  }
  const name = user.firstName + ' ' + user.lastName;
  page.drawText(name, { x: 116, y: 126, size: fit(name, 204, 16), font, color: black });
  for (const [i, label, value] of [
    [0, 'Öğrenci no', String(user.student.number)],
    [1, 'Sınıf', user.student.enrollments[0]?.class.name || 'Atanmamış'],
    [2, 'Akademik yıl', institution?.academicYear || '—'],
  ] as const) {
    page.drawText(label, { x: 116, y: 100 - i * 25, size: 8, font, color: muted });
    page.drawText(value, { x: 116, y: 88 - i * 25, size: 10, font, color: black });
  }
  return { data: await pdf.save(), number: user.student.number };
}
