import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3.js";
import { HttpError } from "./httpError.js";

export const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const CATALOG_PREFIX = "foods/";
export const myFoodPrefix = (userId) => `myfood/${userId}/`;

const KEY_TAIL =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// Builds a new, server-chosen key under the given prefix.
export const newImageKey = (prefix, contentType) => {
  const extension = ALLOWED_IMAGE_TYPES[contentType];

  if (!extension) throw new HttpError(400, "Unsupported image type");

  return `${prefix}${randomUUID()}.${extension}`;
};

// Rejects any key the caller didn't get from our own upload-url endpoint.
export const assertKeyUnderPrefix = (key, prefix) => {
  if (
    typeof key !== "string" ||
    !key.startsWith(prefix) ||
    !KEY_TAIL.test(key.slice(prefix.length))
  ) {
    throw new HttpError(400, "Invalid image key");
  }

  return key;
};

export const presignUpload = (key, contentType) =>
  getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 60 },
  );

export const presignRead = (key) =>
  getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }),
    { expiresIn: 300 },
  );
