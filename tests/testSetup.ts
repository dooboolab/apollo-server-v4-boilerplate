import {ApolloClient, HttpLink, InMemoryCache, split} from '@apollo/client';
import {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import {getMainDefinition} from '@apollo/client/utilities';
import {afterAll, beforeAll, jest} from '@jest/globals';
import {PrismaClient} from '@prisma/client';
import {execSync} from 'child_process';
import {GraphQLClient} from 'graphql-request';
import {createClient} from 'graphql-ws';
import {random} from 'nanoid';
import NodeWebSocket from 'ws';

import {startServer} from '../src/server';
import {assert} from '../src/utils/assert.js';

import {seedUsers} from './seeds';
import {getTestUtils, setTestUtils, TestUtils} from './testUtils';

const {PORT = 5566, DATABASE_URL} = process.env;

export const testSubscriptionHost = `ws://localhost:${PORT}/graphql`;
export const testHost = `http://localhost:${PORT}/graphql`;

assert(DATABASE_URL, 'Missing DATABASE_URL test environment variable.');

jest.setTimeout(30000);

jest.mock('graphql-upload/graphqlUploadExpress.mjs', () => () => {
  return (req, res, next) => {
    return next();
  };
});

jest.mock('nanoid', () => () => {
  return () => random(10);
});

jest.mock('../src/utils/auth', () => ({
  // @ts-ignore
  ...jest.requireActual('../src/utils/auth'),
  getUserId: () => 'alice1234',
}));

beforeAll(async () => {
  const prisma = new PrismaClient();
  await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');

  execSync('yarn db-push:test --accept-data-loss', {env: process.env});

  await seedUsers(prisma);

  // Start server.
  const server = await startServer({port: PORT});

  // Instantiate graphql client.
  const graphqlClient = new GraphQLClient(testHost);
  const httpLink = new HttpLink({uri: testHost});

  const wsLink = new GraphQLWsLink(
    createClient({
      url: testSubscriptionHost,
      webSocketImpl: NodeWebSocket,
    }),
  );

  const splitLink = split(
    ({query}) => {
      const definition = getMainDefinition(query);

      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink,
  );

  const apolloClient = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
  });

  setTestUtils(
    new TestUtils(apolloClient, server, prisma, graphqlClient, wsLink),
  );
});

afterAll(async () => {
  const {server, prisma, wsClient} = getTestUtils();

  // Close server.
  await new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });

    wsClient.client.dispose();
  });

  // Disconnect prisma client.
  await prisma.$disconnect();
});
