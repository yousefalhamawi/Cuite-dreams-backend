import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import path from 'path';
import { getPublicUrl, getR2Client, isR2Configured } from '../config/r2';
import { env } from '../config/env';
import { badRequest, AppError } from '../utils/errors';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

export type UploadFolder = 'products' | 'categories' | 'reviews' | 'misc' | 'receipts';

function assertConfigured(): void {
  if (!isR2Configured()) {
    throw new AppError(
      503,
      'STORAGE_NOT_CONFIGURED',
      'Cloudflare R2 storage is not configured. Set R2_* environment variables.',
    );
  }
}

function sanitizeFolder(folder: string): UploadFolder {
  const allowed: UploadFolder[] = ['products', 'categories', 'reviews', 'misc', 'receipts'];
  if (!allowed.includes(folder as UploadFolder)) {
    throw badRequest(`Invalid folder. Allowed: ${allowed.join(', ')}`);
  }
  return folder as UploadFolder;
}

export function validateImageFile(mimetype: string, size: number): void {
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    throw badRequest('Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF');
  }
  if (size > env.R2_MAX_FILE_SIZE_BYTES) {
    throw badRequest(`File too large. Max size: ${env.R2_MAX_FILE_SIZE_MB}MB`);
  }
}

export async function uploadImage(
  file: Express.Multer.File,
  folder: string,
): Promise<{ key: string; url: string; size: number; contentType: string }> {
  assertConfigured();
  validateImageFile(file.mimetype, file.size);

  const safeFolder = sanitizeFolder(folder);
  const ext = EXT_BY_MIME[file.mimetype] ?? (path.extname(file.originalname) || '.jpg');
  const key = `${safeFolder}/${randomUUID()}${ext}`;

  await getR2Client().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return {
    key,
    url: getPublicUrl(key),
    size: file.size,
    contentType: file.mimetype,
  };
}

export async function deleteImage(key: string): Promise<void> {
  assertConfigured();

  if (!key || key.includes('..')) {
    throw badRequest('Invalid object key');
  }

  await getR2Client().send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
    }),
  );
}
