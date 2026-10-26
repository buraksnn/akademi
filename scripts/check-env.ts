import 'dotenv/config';
import { assertRuntimeConfig } from '../src/lib/config';
assertRuntimeConfig();
console.log('Ortam değişkenleri doğrulandı. Değerler çıktıya yazılmadı.');
