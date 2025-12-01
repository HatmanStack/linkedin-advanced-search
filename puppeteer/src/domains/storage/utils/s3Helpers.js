

import { S3Client, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { logger } from '../../../shared/utils/logger.js';


const clientCache = new Map();


function getS3Client(region) {
  if (!clientCache.has(region)) {
    logger.debug(`Creating new S3Client for region: ${region}`);
    clientCache.set(region, new S3Client({ region }));
  }
  return clientCache.get(region);
}


export async function checkFileExists(bucket, key, region) {
  const client = getS3Client(region);
  try {
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    await client.send(command);
    logger.debug(`File exists in S3: ${key}`);
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      logger.debug(`File not found in S3: ${key}`);
      return false;
    }
    logger.error(`Error checking file existence in S3: ${key}`, {
      error: error.message,
      statusCode: error.$metadata?.httpStatusCode
    });
    throw error;
  }
}


export async function downloadProfileText(bucket, key, region) {
  const client = getS3Client(region);
  try {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    const bodyString = await streamToString(response.Body);
    const data = JSON.parse(bodyString);
    logger.info(`Downloaded profile text from S3: ${key}`, {
      fileSize: bodyString.length,
      profileId: data.profile_id
    });
    return data;
  } catch (error) {
    logger.error(`Error downloading profile text from S3: ${key}`, {
      error: error.message,
      statusCode: error.$metadata?.httpStatusCode
    });
    throw error;
  }
}


async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}


export async function deleteProfileText(bucket, key, region) {
  const client = getS3Client(region);
  try {
    const command = new DeleteObjectCommand({ Bucket: bucket, Key: key });
    await client.send(command);
    logger.info(`Deleted S3 file: ${key}`);
  } catch (error) {
    logger.error(`Error deleting file from S3: ${key}`, {
      error: error.message,
      statusCode: error.$metadata?.httpStatusCode
    });
    throw error;
  }
}


export async function listProfileTexts(bucket, prefix, region, maxKeys = 1000) {
  const client = getS3Client(region);
  try {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    });
    const response = await client.send(command);
    const contents = response.Contents || [];
    logger.info(`Listed ${contents.length} profile text files in S3`, {
      bucket,
      prefix,
      truncated: response.IsTruncated
    });
    return contents;
  } catch (error) {
    logger.error(`Error listing files from S3: ${prefix}`, {
      error: error.message,
      statusCode: error.$metadata?.httpStatusCode
    });
    throw error;
  }
}


export async function verifyUploads(bucket, keys, region) {
  try {
    logger.info(`Verifying ${keys.length} uploads in S3`);
    const results = await Promise.all(
      keys.map(async (key) => {
        try {
          const exists = await checkFileExists(bucket, key, region);
          return { key, exists };
        } catch (error) {
          logger.warn(`Error verifying upload for ${key}:`, error.message);
          return { key, exists: false, error: error.message };
        }
      })
    );
    const existingCount = results.filter(r => r.exists).length;
    logger.info(`Upload verification complete: ${existingCount}/${keys.length} files exist`);
    return results;
  } catch (error) {
    logger.error(`Error during batch upload verification:`, error);
    throw error;
  }
}


export async function getFileMetadata(bucket, key, region) {
  const client = getS3Client(region);
  try {
    const command = new HeadObjectCommand({ Bucket: bucket, Key: key });
    const response = await client.send(command);
    logger.debug(`Retrieved metadata for S3 file: ${key}`);
    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      etag: response.ETag,
      metadata: response.Metadata
    };
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      logger.debug(`File not found in S3: ${key}`);
      return null;
    }
    logger.error(`Error getting metadata from S3: ${key}`, {
      error: error.message,
      statusCode: error.$metadata?.httpStatusCode
    });
    throw error;
  }
}

export default {
  checkFileExists,
  downloadProfileText,
  deleteProfileText,
  listProfileTexts,
  verifyUploads,
  getFileMetadata
};
