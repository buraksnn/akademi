import 'dotenv/config';
import { cp, mkdir, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const root = '.next/standalone';
try {
  await access(root + '/server.js');
} catch {
  throw new Error('Önce npm run build çalıştırın.');
}
await mkdir(root + '/.next', { recursive: true });
await cp('.next/static', root + '/.next/static', { recursive: true });
await cp('public', root + '/public', { recursive: true });
const child = spawn(process.execPath, [root + '/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: process.env.HOSTNAME_OVERRIDE || '0.0.0.0' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
