export const UPLOAD_FILE_SIZE_LIMIT = 100000000;
export const REFRESH_TIME = '365d';
export const ACCESS_TIME = '1h';
export const isProduction = process.env.NODE_ENV === 'production';
export const MAX_IMAGES_UPLOAD_LENGTH = 10;

// https://stackoverflow.com/a/70106896/8841562
// @ts-ignore => Do this because jest doesn't support assert
import pkg from '../../package.json' assert {type: 'json'};

export const version: string = pkg.version;
