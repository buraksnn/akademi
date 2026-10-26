import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) throw new Error('.env zaten var; üzerine yazılmadı.');
let text = readFileSync('.env.example', 'utf8');
const password = randomBytes(24).toString('hex'),
  s3 = randomBytes(24).toString('hex');
text = text
  .replaceAll('CHANGE_ME', password)
  .replace('S3_SECRET_KEY=' + password, 'S3_SECRET_KEY=' + s3)
  .replace('MINIO_ROOT_PASSWORD=' + password, 'MINIO_ROOT_PASSWORD=' + s3);
text = text.replaceAll('GENERATE_32_BYTES_HEX', () => randomBytes(32).toString('hex'));
writeFileSync('.env', text, { mode: 0o600 });
console.log('Yerel .env oluşturuldu. Gizli anahtarlar çıktıya yazılmadı.');
