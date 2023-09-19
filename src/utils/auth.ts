import * as Sentry from '@sentry/node';
import axios from 'axios';
import bcrypt from 'bcrypt';
import ejs from 'ejs';
import type {Request} from 'express';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import * as path from 'path';
import qs from 'querystring';

const SALT_ROUND = 10;

const {REDIRECT_URL, JWT_SECRET = 'undefined'} = process.env;

interface Token {
  userId: string;
}

export function getUserId(authorization?: string): string | null {
  if (!authorization) {
    return null;
  }

  const token = authorization.replace('Bearer ', '');

  try {
    const verifiedToken = jwt.verify(token, JWT_SECRET) as Token;

    return verifiedToken && verifiedToken.userId;
  } catch (err) {
    Sentry.captureEvent({
      message: 'Error in getUserId',
      extra: {error: err, token},
    });

    return null;
  }
}

export const validateEmail = (email: string): boolean => {
  // eslint-disable-next-line max-len
  // eslint-disable-next-line prettier/prettier
  const re =
    /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

  return re.test(email);
};

export interface GoogleUser {
  iss: string;
  sub: string;
  azp: string;
  aud: string;
  iat: number | string;
  exp: number | string;

  /* eslint-disable */
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  /* eslint-enable */
}

/**
 * Verify google token and return user
 * @param token
 * @returns GoogleUser
 */

export const verifyGoogleId = async (token: string): Promise<GoogleUser> => {
  const {data} = await axios.get(
    `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`,
  );

  return data as GoogleUser;
};

export interface FacebookUser {
  id: string;
  name: string;
  email: string;
  picture: {
    data: {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number;
    };
  };
}

export const verifyFacebookId = async (
  accessToken: string,
): Promise<FacebookUser> => {
  const {data} = await axios.get('https://graph.facebook.com/v16.0/me', {
    params: {
      access_token: accessToken,
      fields: 'id,name,email,picture',
    },
  });

  return data as FacebookUser;
};

export const encryptCredential = async (password: string): Promise<string> => {
  const SALT = await bcrypt.genSalt(SALT_ROUND);
  const hash = await bcrypt.hash(password, SALT);

  // Fix the 404 ERROR that occurs when the hash contains 'slash' or 'dot' value
  return hash.replace(/\//g, 'slash').replace(/\.$/g, 'dot');
};

export const validateCredential = async (
  value: string,
  hashedValue: string,
): Promise<boolean> =>
  new Promise<boolean>((resolve, reject) => {
    // Fix the 404 ERROR that occurs when the hash contains 'slash' or 'dot' value
    hashedValue = hashedValue.replace(/slash/g, '/');
    hashedValue = hashedValue.replace(/dot$/g, '.');

    bcrypt.compare(value, hashedValue, (err, res) => {
      if (err) {
        return reject(err);
      }

      resolve(res);
    });
  });

export const getEmailVerificationHTML = (
  verificationCode: string,
  req: Request,
): string => {
  const templateString = fs.readFileSync(
    path.resolve(path.resolve(), './html/email_verification.html'),
    'utf-8',
  );

  const rendered = ejs.render(templateString, {
    VERIFY_EMAIL_REQUEST: req.t('VERIFY_EMAIL_REQUEST'),
    WELCOME: req.t('WELCOME'),
    VERIFICATION_CODE: verificationCode,
    CODE: req.t('CODE'),
    MESSAGE_SENT_ONLY: req.t('MSG_SENT_ONLY'),
    SERVICE_CENTER: req.t('SERVICE_CENTER'),
    /**
     * @deprecated REDIRECT_URL and VERIFY_EMAIL are deprecated in favor of verification code
     */
    REDIRECT_URL: `${REDIRECT_URL}/verify-email/${verificationCode}`,
    VERIFY_EMAIL: req.t('VERIFY_EMAIL'),
  });

  return rendered;
};

export const getPasswordResetHTML = (
  token: string,
  password: string,
  req: Request,
): string => {
  const templateString = fs.readFileSync(
    path.resolve(path.resolve(), './html/password_reset.html'),
    'utf-8',
  );

  const rendered = ejs.render(templateString, {
    REDIRECT_URL: `${REDIRECT_URL}/reset-password/${token}/${qs.escape(
      password,
    )}`,
    HELLO: req.t('HELLO'),
    CLICK_TO_RESET_PW: req.t('CLICK_TO_RESET_PW'),
    PASSWORD: req.t('PASSWORD'),
    CHANGE_PASSWORD: req.t('CHANGE_PASSWORD'),
    MSG_SENT_ONLY: req.t('MSG_SENT_ONLY'),
    SERVICE_CENTER: req.t('SERVICE_CENTER'),
    randomPassword: password,
  });

  return rendered;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getToken = (req: Request): string | null => {
  const authHeader = req.get('authorization');

  if (!authHeader) {
    return null;
  }

  return authHeader.replace('Bearer ', '');
};
