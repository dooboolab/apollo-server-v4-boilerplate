import {describe, expect, it} from '@jest/globals';

import type {Query, QueryUsersArgs} from '../../src/generated/graphql';
import {userQuery, usersQuery} from '../queries/User';
import {getTestUtils} from '../testUtils';

describe('users', () => {
  let userId1: string;
  let userId2: string;

  it('query users', async () => {
    const {graphqlClient} = getTestUtils();

    const response = await graphqlClient.request<
      {users: Query['users']},
      QueryUsersArgs
    >(usersQuery, {
      first: 10,
    });

    expect(response).toHaveProperty('users');
    expect(response.users!.edges).toHaveLength(2);

    userId1 = response.users!.edges![0]!.node!.id;
    userId2 = response.users!.edges![1]!.node!.id;
  });

  it('query user1', async () => {
    const {graphqlClient} = getTestUtils();

    const response = await graphqlClient.request<{user: Query['user']}>(
      userQuery,
      {
        id: userId1,
      },
    );

    expect(response).toHaveProperty('user');
    expect(response.user!.id).toBe(userId1);
  });

  it('query user2', async () => {
    const {graphqlClient} = getTestUtils();

    const response = await graphqlClient.request<{user: Query['user']}>(
      userQuery,
      {
        id: userId2,
      },
    );

    expect(response).toHaveProperty('user');
    expect(response.user!.id).toBe(userId2);
  });
});
