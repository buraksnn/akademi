// Local test fixture. Production uses MinIO/R2 via the application's S3 adapter.
import 'dotenv/config';
import S3rver from 's3rver';
import Account from 's3rver/lib/models/account.js';
import { mkdirSync } from 'node:fs';
if (process.env.NODE_ENV === 'production')
  throw new Error('Test depolaması üretimde kullanılamaz.');
const endpoint = new URL(process.env.S3_ENDPOINT);
if (!['localhost', '127.0.0.1'].includes(endpoint.hostname))
  throw new Error('Yalnızca loopback test adresleri desteklenir.');
Account.DUMMY_ACCOUNT.revokeAccessKey('S3RVER');
Account.DUMMY_ACCOUNT.createKeyPair(process.env.S3_ACCESS_KEY, process.env.S3_SECRET_KEY);
mkdirSync('work/s3-test-data', { recursive: true });
const server = new S3rver({
  address: '127.0.0.1',
  port: Number(endpoint.port) || 9000,
  silent: true,
  directory: 'work/s3-test-data',
  allowMismatchedSignatures: false,
  vhostBuckets: false,
});
server.middleware.unshift(async (ctx, next) => {
  if (!ctx.get('authorization')) {
    ctx.status = 403;
    ctx.body = 'AccessDenied';
    return;
  }
  await next();
});
await server.run();
console.log('Yerel S3 test sunucusu hazır. Anonim erişim kapalı.');
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
