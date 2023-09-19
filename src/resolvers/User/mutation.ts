import type {User} from '@prisma/client';
import {AuthType} from '@prisma/client';
import * as Sentry from '@sentry/node';
import {nanoid} from 'nanoid';

import type {MutationResolvers, Resolvers} from '../../generated/graphql.js';
import {UserService} from '../../services/UserService.js';
import {assert} from '../../utils/assert.js';
import {
  encryptCredential,
  validateCredential,
  verifyFacebookId,
  verifyGoogleId,
} from '../../utils/auth.js';
import type {AzureBlobStreamArgs} from '../../utils/azure.js';
import {
  removeFileFromAzureBlobContainer,
  uploadFileToAzureBlobFromStream,
} from '../../utils/azure.js';
import {getUniqueName, throwClientError} from '../../utils/common.js';
import {sign as jwtSignIn} from '../../utils/jwt.js';
import {createPrismaSelect} from '../../utils/select.js';
import {verifyAppleIdToken} from '../../utils/verifyAppleIdToken.js';

const {APPLE_CLIENT_ID} = process.env;

const signUp: MutationResolvers['signUp'] = async (
  _parent,
  args,
  ctx,
  info,
) => {
  const {req, prisma} = ctx;
  const {user, image} = args;
  const {name, email, password, gender} = user;

  try {
    const hashedPassword = await encryptCredential(password);

    let imageUrl: string | undefined;
    let thumbUrl: string | undefined;

    const canceledAccount = await prisma.user.findFirst({
      where: {
        email,
        deletedAt: {not: null},
      },
    });

    if (canceledAccount) {
      throw new Error(req.t('ERR_USER_CANCELED_ACCOUNT'));
    }

    if (image) {
      const {
        file: {createReadStream},
      } = await image;

      const stream = createReadStream();

      const azBlobArgs: AzureBlobStreamArgs = {
        stream,
        destFile: nanoid(),
        destDir: 'users',
      };

      imageUrl = await uploadFileToAzureBlobFromStream(azBlobArgs);
    }

    const select = createPrismaSelect(info);

    return prisma.user.create({
      select,
      data: {
        name,
        email,
        password: hashedPassword,
        gender,
        locale: req.language,
        photoUrl: imageUrl,
        thumbUrl: thumbUrl,
        settings: {
          create: {
            authType: 'Email',
          },
        },
      },
    }) as unknown as User;
  } catch (err) {
    throwClientError({
      ctx,
      err,
      productionMessage: req.t('ERR_USER_CREATE_FAILED'),
    });
  }
};

const signInEmail: MutationResolvers['signInEmail'] = async (
  _parent,
  args,
  ctx,
  info,
) => {
  const {prisma, req} = ctx;
  const {email, password} = args;
  const select = createPrismaSelect(info);

  try {
    const findUserWithEmail = async (): Promise<User> => {
      const user = await prisma.user.findUnique({
        select: {
          // @ts-ignore => Adhoc: The field type is [AuthPayload] in this case.
          ...(select.user?.select || {}),
          password: true,
        },
        where: {email},
      });

      assert(user, req.t('ERR_USER_NOT_EXISTS'));

      return user as unknown as User;
    };

    const updateLastSignedIn = (): Promise<Partial<User>> =>
      prisma.user.update({
        select: {id: true},
        where: {email},
        data: {lastSignedIn: new Date().toISOString()},
      });

    const user = await findUserWithEmail();

    assert(user.password, req.t('ERR_IS_SOCIAL_USER'));

    if (!(await validateCredential(password, user.password))) {
      throw new Error(req.t('ERR_PASSWORD_INCORRECT'));
    }

    // Remove password from user object
    delete (user as any).password;

    updateLastSignedIn();

    return {
      token: await jwtSignIn(user.id, prisma, true),
      user,
    };
  } catch (err) {
    throwClientError({
      ctx,
      err,
      productionMessage: req.t('ERR_USER_NOT_EXISTS'),
    });
  }
};

const signInWithFacebook: MutationResolvers['signInWithFacebook'] = async (
  _parent,
  {accessToken},
  ctx,
  info,
) => {
  try {
    const {
      id: facebookId,
      name = getUniqueName(),
      email,
      picture: {
        data: {url},
      },
    } = await verifyFacebookId(accessToken);

    return UserService.signInWithSocialAccount(
      {
        socialId: facebookId,
        authType: AuthType.Facebook,
        name,
        email: email || '',
        photoUrl: url,
      },
      ctx,
      info,
    );
  } catch (err) {
    throwClientError({
      ctx,
      err,
      productionMessage: ctx.req.t('ERR_SIGN_IN_WITH_SOCIAL'),
    });
  }
};

const signInWithApple: MutationResolvers['signInWithApple'] = async (
  _parent,
  {accessToken},
  ctx,
  info,
) => {
  assert(APPLE_CLIENT_ID, 'Missing Apple Client ID.');

  try {
    const {sub, email} = await verifyAppleIdToken({
      idToken: accessToken,
      clientId: APPLE_CLIENT_ID,
    });

    return UserService.signInWithSocialAccount(
      {
        socialId: sub,
        authType: AuthType.Apple,
        name: getUniqueName(),
        email,
      },
      ctx,
      info,
    );
  } catch (err) {
    throwClientError({
      ctx,
      err,
      productionMessage: ctx.req.t('ERR_SIGN_IN_WITH_SOCIAL'),
    });
  }
};

const signInWithGoogle: MutationResolvers['signInWithGoogle'] = async (
  _parent,
  {accessToken},
  ctx,
  info,
) => {
  try {
    const {
      sub,
      email,
      name = getUniqueName(),
      picture,
    } = await verifyGoogleId(accessToken);

    return UserService.signInWithSocialAccount(
      {
        socialId: sub,
        authType: AuthType.Google,
        name,
        email,
        photoUrl: picture,
      },
      ctx,
      info,
    );
  } catch (err) {
    throwClientError({
      ctx,
      err,
      productionMessage: ctx.req.t('ERR_SIGN_IN_WITH_SOCIAL'),
    });
  }
};

const updateProfile: MutationResolvers['updateProfile'] = async (
  _parent,
  args,
  ctx,
  info,
) => {
  const {user, image, shouldDeleteImage} = args;
  const {prisma, userId} = ctx;

  assert(userId, ctx.req.t('ERR_NOT_AUTHORIZED'));

  const {birthday, displayName, gender, name, phone} = user;

  try {
    const currentUser = await prisma.user.findUnique({
      where: {id: userId},
      select: {
        id: true,
        displayName: true,
        photoUrl: true,
        thumbUrl: true,
      },
    });

    if (!currentUser) {
      throw new Error(ctx.req.t('ERR_USER_NOT_EXISTS'));
    }

    // 1. Check displayName
    if (displayName) {
      const existingUser = await prisma.user.findFirst({
        where: {
          id: {not: userId},
          displayName: {
            equals: displayName,
            mode: 'insensitive',
          },
        },
        select: {id: true},
      });

      if (existingUser) {
        throw new Error(ctx.req.t('ERR_DISPLAY_NAME_EXISTS'));
      }
    }

    let imageUrl: string | undefined;
    let thumbUrl: string | undefined;

    // 2. Delete image if necessary
    if (currentUser.photoUrl) {
      // 2. Remove previous images in storage if necessary
      if (!shouldDeleteImage) {
        if (image) {
          // Remove previous images if user wants to update images
          if (currentUser.photoUrl) {
            removeFileFromAzureBlobContainer(currentUser.photoUrl);
          }

          if (currentUser.thumbUrl) {
            removeFileFromAzureBlobContainer(currentUser.thumbUrl);
          }

          await prisma.user.update({
            where: {id: userId},
            data: {photoUrl: null, thumbUrl: null},
          });
        }
      } else {
        // Remove previous images if user wants to delete images
        if (currentUser.photoUrl) {
          removeFileFromAzureBlobContainer(currentUser.photoUrl);
        }

        if (currentUser.thumbUrl) {
          removeFileFromAzureBlobContainer(currentUser.thumbUrl);
        }

        await prisma.user.update({
          where: {id: userId},
          data: {photoUrl: null, thumbUrl: null},
        });
      }
    }

    // 3. Upload images to storage if given
    if (image) {
      const {
        file: {createReadStream},
      } = await image;

      const stream = createReadStream();

      const azArgs: AzureBlobStreamArgs = {
        stream,
        destFile: nanoid(),
        destDir: 'users',
      };

      try {
        imageUrl = await uploadFileToAzureBlobFromStream(azArgs);
      } catch (err) {
        throwClientError({
          err,
          ctx,
          productionMessage: ctx.req.t('ERR_UPLOAD'),
        });
      }
    }

    const select = createPrismaSelect(info);

    // 4. Update user profile
    const updated = await prisma.user.update({
      select,
      where: {id: userId},
      data: {
        displayName,
        gender,
        name,
        phone,
        birthday,
        photoUrl: imageUrl,
        thumbUrl,
      },
    });

    return updated as unknown as User;
  } catch (err) {
    throwClientError({
      ctx,
      err,
    });
  }
};

const withdrawUser: MutationResolvers['withdrawUser'] = async (
  _parent,
  _,
  {userId, prisma, req},
) => {
  assert(userId, req.t('ERR_NOT_AUTHORIZED'));

  try {
    await prisma.user.delete({where: {id: userId}});

    return true;
  } catch (err: any) {
    Sentry.captureEvent({
      user: {id: userId},
      message: 'withdrawUser mutation error',
    });

    throw new Error(req.t('ERR_UNKNOWN'));
  }
};

export default <Resolvers['Mutation']>{
  signUp,
  signInEmail,
  signInWithFacebook,
  signInWithApple,
  signInWithGoogle,
  updateProfile,
  withdrawUser,
};
