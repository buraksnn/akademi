import 'dotenv/config';
import { initStorage } from '../src/lib/storage';
await initStorage();
console.log('Özel depolama hazır. Public erişim tanımlanmadı.');
