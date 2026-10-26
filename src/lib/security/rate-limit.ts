import { db } from '@/lib/db';
import { privateKey } from './crypto';
import { AppError } from '@/lib/errors';
export async function rateLimit(scope: string, identity: string, limit = 10, seconds = 900) {
  const key = privateKey(scope + ':' + identity);
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,NOW()+${seconds}*INTERVAL '1 second') ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt"<NOW() THEN 1 ELSE "RateLimit"."count"+1 END,"expiresAt"=CASE WHEN "RateLimit"."expiresAt"<NOW() THEN NOW()+${seconds}*INTERVAL '1 second' ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > limit)
    throw new AppError(429, 'Çok fazla deneme yaptınız. Bir süre sonra tekrar deneyin.');
}
