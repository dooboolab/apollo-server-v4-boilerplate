import {ApolloServer} from '@apollo/server';
import {expressMiddleware} from '@apollo/server/express4';
import {ApolloServerPluginDrainHttpServer} from '@apollo/server/plugin/drainHttpServer';
import {makeExecutableSchema} from '@graphql-tools/schema';
import SendGridMail from '@sendgrid/mail';
import bodyParser from 'body-parser';
import cors from 'cors';
import type express from 'express';
import {importSchema} from 'graphql-import';
import {applyMiddleware} from 'graphql-middleware';
import type {Server} from 'http';
import {createServer as createHttpServer} from 'http';

import {permissions} from './permissions/index.js';
import resolvers from './resolvers/index.js';
import {assert} from './utils/assert.js';
import {isProduction} from './utils/const.js';
import {createExpressApp} from './app.js';
import type {Context} from './context.js';
import {createContext, startSubscriptionServer} from './context.js';

const {NODE_ENV, SENDGRID_API_KEY = 'any', PORT = 5051} = process.env;

assert(SENDGRID_API_KEY, 'Missing SENDGRID_API_KEY environment variable.');
SendGridMail.setApiKey(SENDGRID_API_KEY);

const expressApp = createExpressApp();
const typeDefs = importSchema('schemas/schema.graphql');

export const schema = makeExecutableSchema({typeDefs, resolvers});
export const schemaWithMiddleware = applyMiddleware(schema, permissions);

const createApolloServer = (httpServer: Server): ApolloServer<Context> => {
  const serverCleanUp = startSubscriptionServer(httpServer);

  return new ApolloServer<Context>({
    schema: schemaWithMiddleware,
    introspection:
      process.env.NODE_ENV !== 'production' &&
      process.env.NODE_ENV !== 'staging',
    plugins: [
      ApolloServerPluginDrainHttpServer({httpServer}),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              if (serverCleanUp) {
                serverCleanUp.dispose();
              }
            },
          };
        },
      },
    ],
  });
};

const gqlChecker = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void => {
  // TODO: Protect the GQL endpoint in production.
  if (isProduction && req.method === 'POST' && req.path === '/graphql') {
    if (req.get('secret') !== process.env.GQL_SECRET) {
      res.status(400).send('Bad Request');

      return;
    }
  }

  next();
};

const configureMiddleware = ({
  apolloServer,
  app,
  port,
}: {
  apolloServer: ApolloServer<Context>;
  httpServer: Server;
  app: express.Application;
  port: number;
}): (() => void) => {
  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    bodyParser.json(),
    gqlChecker,
    expressMiddleware(apolloServer, {
      // @ts-ignore
      context: async ({req, res}) => createContext({req, res}),
    }),
  );

  return (): void => {
    process.stdout.write(
      `🚀 Server ready at http://localhost:${port}/graphql\n`,
    );
  };
};

export const startServer = async ({
  port,
}: {
  port: number | string;
}): Promise<Server> => {
  const httpServer = createHttpServer(expressApp);
  const apolloServer = createApolloServer(httpServer);
  await apolloServer.start();

  const handleApolloServerInit = configureMiddleware({
    apolloServer,
    app: expressApp,
    httpServer,
    port: Number(port),
  });

  return httpServer.listen({port}, () => {
    handleApolloServerInit();
  });
};

if (NODE_ENV !== 'test') {
  startServer({port: PORT});

  // Note: below is sample of cron job.
  // const rule = new schedule.RecurrenceRule();

  // rule.tz = 'Asia/Seoul';
  // rule.dayOfWeek = [0, new schedule.Range(0, 6)];
  // rule.hour = 4;
  // rule.minute = 0;

  // schedule.scheduleJob(rule, () => {
  // });
}
