import 'dotenv/config';
import { db } from '../src/lib/db';
import { deleteObject } from '../src/lib/storage';
const now = new Date();
await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
await db.passwordResetToken.deleteMany({ where: { expiresAt: { lt: now } } });
await db.emailVerificationToken.deleteMany({ where: { expiresAt: { lt: now } } });
await db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } });
for (const row of await db.storageGarbage.findMany({ take: 100 })) {
  await deleteObject(row.objectKey);
  await db.storageGarbage.delete({ where: { id: row.id } });
}
await db.$disconnect();
console.log('Süresi dolmuş oturumlar, tokenlar ve eski fotoğraflar temizlendi.');
