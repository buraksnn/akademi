import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
export function storage() {
  const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env;
  if (!S3_ENDPOINT || !S3_ACCESS_KEY || !S3_SECRET_KEY)
    throw new Error('Özel dosya depolama yapılandırılmamış.');
  return new S3Client({
    endpoint: S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
  });
}
export const bucket = () => process.env.S3_BUCKET || 'akademi-private';
export async function putObject(key: string, data: Buffer) {
  await storage().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: data,
      ContentType: 'image/jpeg',
      CacheControl: 'private, no-store',
    }),
  );
}
export async function getObject(key: string) {
  const result = await storage().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!result.Body) throw new Error('Dosya bulunamadı.');
  return Buffer.from(await result.Body.transformToByteArray());
}
export async function deleteObject(key: string) {
  await storage().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
export async function initStorage() {
  try {
    await storage().send(new HeadBucketCommand({ Bucket: bucket() }));
  } catch (error) {
    if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404)
      throw error;
    await storage().send(new CreateBucketCommand({ Bucket: bucket() }));
  }
}
