import { AppError } from '@/lib/errors';
export function requireSameOrigin(origin: string | null) {
  if (origin !== new URL(process.env.APP_URL || 'http://localhost:3000').origin)
    throw new AppError(403, 'İstek kaynağı doğrulanamadı.');
}
export async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get('content-length')) > limit)
    throw new AppError(413, 'İstek boyutu sınırı aşıldı.');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new AppError(413, 'İstek boyutu sınırı aşıldı.');
      }
      parts.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    output.set(p, offset);
    offset += p.length;
  }
  return output;
}
