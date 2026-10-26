import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { z } from 'zod';
import { db } from '../src/lib/db';
import { emailSchema, passwordSchema, validTckn } from '../src/lib/validation';
import { hashPassword } from '../src/lib/security/password';
import { blindIndex, encryptIdentity } from '../src/lib/security/crypto';
import { assertRuntimeConfig } from '../src/lib/config';
async function readSecret() {
  if (!process.stdin.isTTY)
    throw new Error('Parola için etkileşimli terminal veya --stdin JSON kullanın.');
  process.stdout.write('Şifre (en az 12 karakter): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = '';
  return new Promise<string>((resolve, reject) => {
    const handler = (chunk: Buffer) => {
      for (const char of chunk.toString()) {
        if (char === '\r' || char === '\n') {
          process.stdin.off('data', handler);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          process.stdin.setRawMode(false);
          reject(new Error('İptal edildi.'));
          return;
        }
        if (char === '\u007f') value = value.slice(0, -1);
        else value += char;
      }
    };
    process.stdin.on('data', handler);
  });
}
async function main() {
  assertRuntimeConfig();
  let raw: unknown;
  if (process.argv.includes('--stdin')) {
    let source = '';
    for await (const chunk of process.stdin) source += chunk;
    if (source.length > 10000) throw new Error('Geçersiz giriş.');
    raw = JSON.parse(source);
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const firstName = await rl.question('Ad: '),
      lastName = await rl.question('Soyad: '),
      email = await rl.question('E-posta: ');
    rl.close();
    raw = { firstName, lastName, email, password: await readSecret() };
  }
  const d = z
    .object({
      firstName: z.string().min(2).max(80),
      lastName: z.string().min(2).max(80),
      email: emailSchema,
      password: passwordSchema,
      tckn: z.string().refine(validTckn).optional(),
    })
    .parse(raw);
  const passwordHash = await hashPassword(d.password);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(92741)`;
    if (await tx.user.count({ where: { role: 'ADMIN' } }))
      throw new Error(
        'İlk yönetici zaten oluşturulmuş. Sonraki yöneticileri yönetim panelinden yetkilendirin.',
      );
    const user = await tx.user.create({
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        passwordHash,
        role: 'ADMIN',
        emailVerified: new Date(),
        ...(d.tckn
          ? {
              tcEncrypted: encryptIdentity(d.tckn),
              tcIndex: blindIndex(d.tckn),
              tcLastTwo: d.tckn.slice(-2),
            }
          : {}),
      },
    });
    await tx.institutionSettings.upsert({
      where: { id: 'main' },
      create: { id: 'main' },
      update: {},
    });
    await tx.auditLog.create({ data: { actorId: user.id, action: 'ADMIN_BOOTSTRAPPED' } });
  });
  console.log('İlk yönetici oluşturuldu. Giriş ekranından devam edebilirsiniz.');
}
main()
  .catch((e) => {
    console.error(
      e instanceof z.ZodError
        ? 'Alanları ve şifre uzunluğunu kontrol edin.'
        : e instanceof Error
          ? e.message
          : 'İşlem başarısız.',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
