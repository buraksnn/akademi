import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes } from 'node:crypto';
export function key(name: string) {
  const value = process.env[name];
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new Error(`${name}: 32 bayt hex anahtar gerekli.`);
  return Buffer.from(value, 'hex');
}
export const randomToken = () => randomBytes(32).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function blindIndex(value: string) {
  return createHmac('sha256', key('TCKN_HMAC_KEY')).update(value).digest('hex');
}
export function encryptIdentity(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key('TCKN_ENCRYPTION_KEY'), iv);
  cipher.setAAD(Buffer.from('akademi:tckn:v1'));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    data.toString('base64url'),
  ].join('.');
}
export function decryptIdentity(value: string) {
  const [v, iv, tag, data] = value.split('.');
  if (v !== 'v1') throw new Error('Desteklenmeyen anahtar sürümü');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    key('TCKN_ENCRYPTION_KEY'),
    Buffer.from(iv, 'base64url'),
  );
  cipher.setAAD(Buffer.from('akademi:tckn:v1'));
  cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([cipher.update(Buffer.from(data, 'base64url')), cipher.final()]).toString(
    'utf8',
  );
}
export const privateKey = (value: string) =>
  createHmac('sha256', key('AUTH_SECRET')).update(value).digest('hex');
