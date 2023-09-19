import type {AuthType, Gender, User} from '@prisma/client';
import type {GraphQLResolveInfo} from 'graphql';

import type {Context} from '../context.js';
import {throwClientError} from '../utils/common.js';
import {sign as jwtSignIn} from '../utils/jwt.js';
import {createPrismaSelect} from '../utils/select.js';

export interface SocialUserInput {
  socialId: string;
  authType: AuthType;
  name: string;
  email?: string;
  birthday?: Date;
  gender?: Gender;
  phone?: string;
  photoUrl?: string;
  thumbUrl?: string;
}

export class UserService {
  static async signInWithSocialAccount(
    socialUser: SocialUserInput,
    ctx: Context,
    info: GraphQLResolveInfo,
  ): Promise<{
    token: string;
    user: User;
  }> {
    await UserService.validateSocialUser(socialUser, ctx);

    try {
      const user = await UserService.createOrGetUserBySocialUserInput(
        socialUser,
        ctx,
        info,
      );

      await ctx.prisma.user.updateMany({
        where: {settings: {socialId: socialUser.socialId}},
        data: {lastSignedIn: new Date().toISOString()},
      });

      const token = await jwtSignIn(user.id as string, ctx.prisma, true);

      return {
        token,
        user,
      };
    } catch (err) {
      throwClientError({
        ctx,
        err,
        productionMessage: ctx.req.t('ERR_SIGN_IN_WITH_SOCIAL'),
      });
    }
  }

  private static async validateSocialUser(
    socialUser: SocialUserInput,
    ctx: Context,
  ): Promise<void> {
    if (socialUser.email) {
      const emailUser = await ctx.prisma.user.findFirst({
        select: {id: true},
        where: {
          email: socialUser.email,
          settings: {
            socialId: {
              not: socialUser.socialId,
            },
          },
        },
      });

      if (emailUser) {
        throw new Error(ctx.req.t('ERR_EMAIL_ALREADY_EXISTS'));
      }
    }
  }

  private static async createOrGetUserBySocialUserInput(
    socialUser: SocialUserInput,
    ctx: Context,
    info: GraphQLResolveInfo,
  ): Promise<User> {
    const select = createPrismaSelect(info);

    const user = await ctx.prisma.user.findFirst({
      select: {
        // @ts-ignore => Adhoc: The field type is [AuthPayload] in this case.
        ...(select.user?.select || {}),
        settings: true,
      },
      where: {settings: {socialId: socialUser.socialId}},
    });

    if (!user) {
      const created = await ctx.prisma.user.create({
        select: {
          // @ts-ignore => Adhoc: The field type is [AuthPayload] in this case.
          ...(select.user?.select || {}),
          settings: true,
        },
        data: {
          settings: {
            create: {
              socialId: socialUser.socialId,
              authType: socialUser.authType,
            },
          },
          locale: ctx.req.language,
          email: socialUser.email || undefined,
          name: socialUser.name,
          birthday: socialUser.birthday,
          phone: socialUser.phone,
          verifiedAt: new Date().toISOString(),
          photoUrl: socialUser.photoUrl,
          thumbUrl: socialUser.thumbUrl,
        },
      });

      return created as unknown as User;
    }

    return user as unknown as User;
  }
}
