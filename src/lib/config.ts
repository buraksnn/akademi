import { key } from './security/crypto';
export function assertRuntimeConfig() {
  for (const name of ['AUTH_SECRET', 'TCKN_ENCRYPTION_KEY', 'TCKN_HMAC_KEY']) key(name);
  if (
    new Set(['AUTH_SECRET', 'TCKN_ENCRYPTION_KEY', 'TCKN_HMAC_KEY'].map((n) => process.env[n]))
      .size !== 3
  )
    throw new Error('Gizli anahtarlar birbirinden farklı olmalı.');
  for (const name of [
    'DATABASE_URL',
    'APP_URL',
    'SMTP_HOST',
    'SMTP_FROM',
    'S3_ENDPOINT',
    'S3_BUCKET',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
  ])
    if (!process.env[name]) throw new Error(name + ' gerekli.');
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.APP_URL!.startsWith('https://'))
      throw new Error('Üretimde HTTPS APP_URL gerekli.');
    if (!process.env.S3_ENDPOINT!.startsWith('https://'))
      throw new Error('Üretimde HTTPS S3_ENDPOINT gerekli.');
  }
}
