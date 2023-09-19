import type {ApolloClient} from '@apollo/client';
import type {GraphQLWsLink} from '@apollo/client/link/subscriptions';
import type {PrismaClient} from '@prisma/client';
import type {GraphQLClient} from 'graphql-request';
import type {Server} from 'http';

import {assert} from '../src/utils/assert.js';

export class TestUtils {
  public apolloClient: ApolloClient<any>;
  public server: Server;
  public prisma: PrismaClient;
  public graphqlClient: GraphQLClient;
  public wsClient: GraphQLWsLink;

  constructor(
    apolloClient: ApolloClient<any>,
    server: Server,
    prisma: PrismaClient,
    graphqlClient: GraphQLClient,
    wsClient: GraphQLWsLink,
  ) {
    this.apolloClient = apolloClient;
    this.server = server;
    this.prisma = prisma;
    this.graphqlClient = graphqlClient;
    this.wsClient = wsClient;
  }

  setAuthToken = (token: string): void => {
    this.graphqlClient.setHeader('authorization', `${token}`);
  };
}

let _testUtils: TestUtils | undefined;

export function getTestUtils(): TestUtils {
  assert(_testUtils, 'Test utilities are not initialized.');

  return _testUtils;
}

export function setTestUtils(value: TestUtils): void {
  _testUtils = value;
}
