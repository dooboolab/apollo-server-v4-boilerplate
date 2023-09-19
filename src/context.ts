import {PrismaClient} from '@prisma/client';
import type express from 'express';
import {PubSub} from 'graphql-subscriptions';
import {useServer} from 'graphql-ws/lib/use/ws';
import type {Server} from 'http';
import {WebSocketServer} from 'ws';

import type en from '../locales/en.json';

import {assert} from './utils/assert.js';
import {getUserId} from './utils/auth.js';
import {i18n} from './app.js';
import {schema} from './server.js';

const {JWT_SECRET, JWT_SECRET_ETC} = process.env;

export interface Context {
  req: Omit<express.Request, 't'> & {
    t: (param: keyof typeof en, params?: object) => string;
  };
  prisma: PrismaClient;
  pubsub: PubSub;
  appSecret: string;
  appSecretEtc: string;
  userId: string | null;
}

export const pubsub = new PubSub();

const createPrismaClient = (): PrismaClient => {
  const prisma = new PrismaClient();

  //! Specify soft deletion models here.
  prisma.$use(async (params, next) => {
    const softDeletionModels = ['User'];

    if (params.model && softDeletionModels.includes(params.model)) {
      if (params.action === 'delete') {
        params.action = 'update';
        params.args.data = {deletedAt: new Date().toISOString()};
      }

      if (params.action === 'deleteMany') {
        params.action = 'updateMany';

        if (params.args.data !== undefined) {
          params.args.data.deletedAt = new Date().toISOString();
        } else {
          params.args.data = {deletedAt: new Date().toISOString()};
        }
      }

      if (params.action === 'findUnique') {
        if (Object.keys(params.args.where).some((el) => el.includes('_'))) {
          return next(params);
        }

        params.action = 'findFirst';
        if (!params.args) {
          params.args = {where: {}};
        }

        params.args.where.deletedAt = null;
      }

      if (params.action === 'count' || params.action === 'aggregate') {
        if (!params.args) {
          params.args = {where: {}};
        }

        params.args.where.deletedAt = null;
      }

      if (params.action === 'findMany' || params.action === 'findFirst') {
        if (!params.args) {
          params.args = {where: {}};
        }

        if (params.args.where !== undefined) {
          if (params.args.where.deletedAt === undefined) {
            params.args.where.deletedAt = null;
          }
        } else {
          params.args.where = {deletedAt: null};
        }
      }
    }

    return next(params);
  });

  return prisma;
};

export const prisma = createPrismaClient();

type CreateContextParams = {
  req: Omit<express.Request, 't'> & {
    t: (param: keyof typeof en, params?: object) => string;
  };
  res: express.Response;
};

export function createContext(params: CreateContextParams): Context {
  const {req} = params;
  const authorization = req.get('Authorization');

  assert(JWT_SECRET, 'Missing JWT_SECRET environment variable');
  assert(JWT_SECRET_ETC, 'Missing JWT_SECRET_ETC environment variable.');

  let userId: string | null = null;
  userId = getUserId(authorization);

  return {
    req,
    prisma,
    pubsub,
    appSecret: JWT_SECRET,
    appSecretEtc: JWT_SECRET_ETC,
    userId,
  };
}

const getDynamicContext = (
  ctx,
): {req: {t: typeof i18n}} & Omit<Context, 'req'> => {
  assert(JWT_SECRET, 'Missing JWT_SECRET environment variable');
  assert(JWT_SECRET_ETC, 'Missing JWT_SECRET_ETC environment variable.');

  // ctx is the graphql-ws Context where connectionParams live
  let userId: string | null = null;
  const authorization =
    ctx.connectionParams?.Authorization || ctx.connectionParams?.authorization;

  if (authorization) {
    userId = getUserId(authorization);
  }

  return {
    prisma,
    pubsub,
    appSecret: JWT_SECRET,
    appSecretEtc: JWT_SECRET_ETC,
    userId,
    req: {
      t: i18n,
    },
  };
};

export const startSubscriptionServer = (
  httpServer: Server,
): ReturnType<typeof startSubscriptionServer> => {
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  return useServer(
    {
      schema,
      // https://www.apollographql.com/docs/apollo-server/data/subscriptions/#operation-context
      context: (ctx) => {
        return getDynamicContext(ctx);
      },
    },
    wsServer,
  );
};
