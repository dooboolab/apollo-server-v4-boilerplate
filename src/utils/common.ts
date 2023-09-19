import type {Image} from '@prisma/client';
import type {Config} from 'unique-names-generator';
import {
  animals,
  colors,
  NumberDictionary,
  uniqueNamesGenerator,
} from 'unique-names-generator';

import type {Context} from '../context.js';
import {prisma} from '../context.js';
import type {InputMaybe} from '../generated/graphql.js';

import {removeFileFromAzureBlobContainer} from './azure.js';
import {isProduction} from './const.js';

export const hasExistingImageInArray = (
  image: Image,
  imageUrls: string[],
): boolean => {
  return (
    (!!image.imageUrl && imageUrls?.includes(image.imageUrl)) ||
    (!!image.thumbUrl && imageUrls?.includes(image.thumbUrl)) ||
    (!!image.thumbUrlHigh && imageUrls?.includes(image.thumbUrlHigh))
  );
};

export const handleDeleteImageUrls = async (
  deleteImageUrls: InputMaybe<string>[],
): Promise<void> => {
  if (deleteImageUrls && deleteImageUrls.length > 0) {
    const images = await prisma.image.findMany({
      where: {
        OR: [
          {imageUrl: {in: deleteImageUrls as string[]}},
          {thumbUrl: {in: deleteImageUrls as string[]}},
          {thumbUrlHigh: {in: deleteImageUrls as string[]}},
        ],
      },
    });

    for (const existingImage of images) {
      if (hasExistingImageInArray(existingImage, deleteImageUrls as string[])) {
        if (existingImage.imageUrl) {
          removeFileFromAzureBlobContainer(existingImage.imageUrl);
        }

        if (existingImage.thumbUrl) {
          removeFileFromAzureBlobContainer(existingImage.thumbUrl);
        }

        if (existingImage.thumbUrlHigh) {
          removeFileFromAzureBlobContainer(existingImage.thumbUrlHigh);
        }

        await prisma.image.delete({where: {id: existingImage.id}});
      }
    }
  }
};

export function throwClientError({
  ctx,
  err,
  productionMessage,
}: {
  ctx: Context;
  err: any;
  productionMessage?: string;
}): never {
  // eslint-disable-next-line no-console
  !isProduction && console.error(err);

  if (isProduction) {
    throw new Error(productionMessage || ctx.req.t('ERR_UNKNOWN'));
  }

  throw new Error(err);
}

export function getCurrentDateInYYYYMMDD(date: Date): string {
  const YYYY = date.getFullYear().toString();
  const MM = String(date.getMonth() + 1); // +1 because months are 0-based
  const dd = String(date.getDate());

  return `${YYYY}-${MM}-${dd}`;
}

export function getUniqueName(): string {
  const numberDictionary = NumberDictionary.generate({min: 100, max: 999});

  const config: Config = {
    dictionaries: [colors, animals],
    separator: '-',
  };

  return uniqueNamesGenerator(config) + numberDictionary;
}

export function getRandom8DigitNumber(): number {
  return Math.floor(Math.random() * (99999999 - 10000000 + 1)) + 10000000;
}
