import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import type Stream from 'stream';

import {assert} from './assert.js';

const {STORAGE_ACCOUNT, STORAGE_KEY, STORAGE_ENDPOINT} = process.env;
const containerName = '<your-container-name>';

const blobService =
  STORAGE_ACCOUNT && STORAGE_KEY && STORAGE_ENDPOINT
    ? new BlobServiceClient(
        STORAGE_ENDPOINT,
        new StorageSharedKeyCredential(STORAGE_ACCOUNT, STORAGE_KEY),
      )
    : undefined;

export function resolveBlobName(destFile: string, destDir: string): string {
  destDir = destDir ? `${destDir}/` : '';

  return decodeURIComponent(`${destDir}${destFile}`);
}

export type AzureBlobStreamArgs = {
  stream: Stream.Readable;
  destFile: string;
  destDir: string;
};

/**
 * Upload a file stream to Azure Storage.
 * @param stream Stream to be uploaded.
 * @param destFile Destination file name.
 * @param destDir Destination directory name.
 * @returns Azure Storage URL.
 */
export const uploadFileToAzureBlobFromStream = async ({
  stream,
  destDir,
  destFile,
}: AzureBlobStreamArgs): Promise<string> => {
  try {
    assert(blobService, 'Storage is not initialized.');

    const containerClient = blobService.getContainerClient(containerName);

    const blockBlobClient = containerClient.getBlockBlobClient(
      resolveBlobName(destFile, destDir),
    );

    await blockBlobClient.uploadStream(stream);

    return blockBlobClient.url;
  } catch (e: any) {
    throw new Error(e);
  }
};

/**
 * Upload a file to Azure Storage.
 * @param file Path to the file to be uploaded.
 * @param destFile destination file name.
 * @param destDir Destination directory name.
 * @returns Azure Storage URL.
 */
export const uploadFileToAzureBlobFromFile = async ({
  file,
  destDir,
  destFile,
}: {
  file: string;
  destFile: string;
  destDir: string;
}): Promise<string> => {
  assert(blobService, 'Storage is not initialized.');

  const blockBlobClient = blobService
    .getContainerClient(containerName)
    .getBlockBlobClient(resolveBlobName(destFile, destDir));

  await blockBlobClient.uploadFile(file);

  return blockBlobClient.url;
};

/**
 * Upload a file to Azure Storage.
 * @param deleteURL Azure file url to delete
 * @returns Azure Storage URL | undefined
 */
export const removeFileFromAzureBlobContainer = async (
  deleteURL: string,
): Promise<string | undefined> => {
  assert(blobService, 'Azure Storage is not initialized.');

  const blobRootURL = blobService.url;
  deleteURL = decodeURI(deleteURL);

  if (!deleteURL.startsWith(blobRootURL)) {
    return;
  }

  const fileName = deleteURL.replace(blobRootURL, '').split('/');
  const blobName = fileName.shift();

  if (blobName) {
    const decodedBlobName = decodeURIComponent(blobName);
    const containerClient = blobService.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(decodedBlobName);

    blockBlobClient.deleteIfExists();

    return blockBlobClient.url;
  }

  return undefined;
};
