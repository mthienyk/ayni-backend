import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env, isR2Configured } from "../config.js";

const PRESIGN_TTL_SECONDS = 900;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!isR2Configured()) {
    throw new Error("R2 is not configured");
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

export function buildObjectKey(
  userId: string,
  itemId: string,
  filename: string,
): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `items/${userId}/${itemId}/${Date.now()}-${safe}`;
}

export function publicUrlForKey(key: string): string {
  if (env.R2_PUBLIC_BASE_URL) {
    return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
  }
  return `${env.API_BASE_URL}/uploads/${key}`;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string }> {
  if (!isR2Configured()) {
    return {
      uploadUrl: `${env.API_BASE_URL}/v1/dev-upload/${encodeURIComponent(key)}`,
      key,
    };
  }

  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGN_TTL_SECONDS,
  });
  return { uploadUrl, key };
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  if (!isR2Configured()) {
    const localPath = join(env.LOCAL_UPLOAD_DIR, key);
    if (!existsSync(localPath)) {
      throw new Error(`Local object not found: ${key}`);
    }
    const { readFileSync } = await import("node:fs");
    return readFileSync(localPath);
  }

  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`Empty object: ${key}`);
  }
  return Buffer.from(bytes);
}

export async function putObjectBuffer(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (!isR2Configured()) {
    const localPath = join(env.LOCAL_UPLOAD_DIR, key);
    mkdirSync(join(localPath, ".."), { recursive: true });
    writeFileSync(localPath, body);
    return;
  }

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export function saveLocalUpload(key: string, data: Buffer): void {
  const localPath = join(env.LOCAL_UPLOAD_DIR, key);
  mkdirSync(join(localPath, ".."), { recursive: true });
  writeFileSync(localPath, data);
}

export function localUploadStream(key: string) {
  return createReadStream(join(env.LOCAL_UPLOAD_DIR, key));
}
