import type {PrismaClient} from '@prisma/client';
import * as Sentry from '@sentry/node';
import jwt from 'jsonwebtoken';

import {ACCESS_TIME, REFRESH_TIME} from './const.js';

const {JWT_SECRET = 'undefined'} = process.env;

interface Token {
  userId: string;
}

interface VerifiedToken {
  verified?: boolean;
  message?: string;
  userId: string;
}

export const sign = async (
  userId: string,
  prisma?: PrismaClient,
  shouldGenerateRefreshToken?: boolean,
): Promise<string> => {
  const payload: Token = {
    userId,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TIME,
  });

  if (prisma && shouldGenerateRefreshToken) {
    const refreshToken = jwt.sign({}, JWT_SECRET, {
      expiresIn: REFRESH_TIME,
    });

    await prisma.user.update({
      data: {
        settings: {
          upsert: {
            create: {refreshToken},
            update: {refreshToken},
          },
        },
      },
      where: {id: userId},
    });
  }

  return accessToken;
};

export const verify = (token: string): VerifiedToken => {
  let decoded: Token;

  try {
    decoded = jwt.verify(token, JWT_SECRET) as Token;

    return {
      verified: true,
      userId: decoded.userId,
    };
  } catch (err: any) {
    return {
      verified: false,
      message: err.message,
      userId: '',
    };
  }
};

export const getRefreshToken = async (
  userId: string,
  prisma: PrismaClient,
): Promise<string | null | undefined> => {
  const data = await prisma.settings.findUnique({
    select: {refreshToken: true},
    where: {userId},
  });

  return data?.refreshToken;
};

export const refresh = async (
  userId: string,
  prisma: PrismaClient,
): Promise<string | null | undefined> => {
  try {
    const newToken = jwt.sign({}, JWT_SECRET, {
      expiresIn: REFRESH_TIME,
    });

    await prisma.settings.update({
      data: {refreshToken: newToken},
      where: {userId},
    });

    return newToken;
  } catch (err) {
    Sentry.captureException({
      message: 'refresh token error',
      err,
      userId,
    });
  }
};

type VerifyRefreshResult = {
  result: boolean;
  accessToken?: string;
  userId?: string;
};

export const verifyWithRefresh = async (
  accessToken: string,
  prisma: PrismaClient,
): Promise<VerifyRefreshResult> => {
  try {
    const accessResult = verify(accessToken);
    const accessDecoded = jwt.decode(accessToken) as VerifiedToken;
    const refreshToken = await getRefreshToken(accessDecoded.userId, prisma);

    if (accessResult.verified) {
      if (!refreshToken) {
        refresh(accessDecoded.userId, prisma);
      }

      return {result: true, accessToken, userId: accessDecoded.userId};
    }

    if (!refreshToken) {
      return {result: false, accessToken: undefined, userId: undefined};
    }

    const newAccessToken = await sign(accessDecoded.userId);

    return {
      result: true,
      accessToken: newAccessToken,
      userId: accessDecoded.userId,
    };
  } catch (err: any) {
    Sentry.captureException({
      message: 'verifyRefresh error',
      err,
    });

    return {result: false, accessToken: undefined, userId: undefined};
  }
};
