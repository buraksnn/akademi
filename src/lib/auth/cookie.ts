import { sealData, unsealData } from 'iron-session';
import { key } from '@/lib/security/crypto';
export async function sealSessionToken(token: string, ttl: number) {
  return sealData({ token }, { password: key('AUTH_SECRET').toString('hex'), ttl });
}
export async function unsealSessionToken(cookie: string | undefined) {
  if (!cookie || cookie.length > 4096) return undefined;
  const data = await unsealData<{ token?: string }>(cookie, {
    password: key('AUTH_SECRET').toString('hex'),
  });
  return typeof data.token === 'string' ? data.token : undefined;
}
