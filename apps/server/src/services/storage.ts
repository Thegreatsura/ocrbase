import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@ocrbase/env/server";
import { S3Client as BunS3Client } from "bun";

const DEFAULT_PRESIGNED_EXPIRY = 3600;

const bunS3 = new BunS3Client({
  accessKeyId: env.S3_ACCESS_KEY ?? "",
  bucket: env.S3_BUCKET,
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  secretAccessKey: env.S3_SECRET_KEY ?? "",
});

const s3Client = new S3Client({
  credentials:
    env.S3_ACCESS_KEY && env.S3_SECRET_KEY
      ? {
          accessKeyId: env.S3_ACCESS_KEY,
          secretAccessKey: env.S3_SECRET_KEY,
        }
      : undefined,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  region: env.S3_REGION,
});

export const StorageService = {
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    });
    await s3Client.send(command);
  },

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      });
      await s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  },

  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    });
    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error(`File not found: ${key}`);
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  },

  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = DEFAULT_PRESIGNED_EXPIRY
  ): string {
    return bunS3.file(key).presign({
      expiresIn,
      method: "PUT",
      type: contentType,
    });
  },

  async getPresignedUrl(
    key: string,
    expiresIn: number = DEFAULT_PRESIGNED_EXPIRY
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn });
  },

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<void> {
    const command = new PutObjectCommand({
      Body: buffer,
      Bucket: env.S3_BUCKET,
      ContentType: contentType,
      Key: key,
    });
    await s3Client.send(command);
  },
};

export const checkStorageHealth = async (): Promise<boolean> => {
  try {
    const command = new HeadBucketCommand({ Bucket: env.S3_BUCKET });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
};

export { s3Client };
