import type {Prisma, User} from '@prisma/client';

import type {QueryResolvers, Resolvers} from '../../generated/graphql.js';
import {assert} from '../../utils/assert.js';
import {
  getEdges,
  getPageInfo,
  relayToPrismaPagination,
} from '../../utils/pagination.js';
import {createPrismaSelect} from '../../utils/select.js';

const users: QueryResolvers['users'] = async (_, args, {prisma}, info) => {
  const lowerSearchText = args.searchText?.toLocaleLowerCase();
  const searchArgs: Prisma.UserWhereInput = lowerSearchText
    ? {
        OR: [
          {name: {contains: lowerSearchText, mode: 'insensitive'}},
          {
            displayName: {
              contains: lowerSearchText,
              mode: 'insensitive',
            },
          },
          {email: {contains: lowerSearchText, mode: 'insensitive'}},
        ],
      }
    : {};

  const select = createPrismaSelect(info);

  const data = await prisma.user.findMany({
    select,
    ...relayToPrismaPagination(args),
    where: searchArgs,
    orderBy: {id: args.first ? 'desc' : 'asc'},
  });

  const edges = getEdges(data as unknown as User[]);
  const pageInfo = getPageInfo(edges, args);

  return {
    pageInfo,
    edges,
  };
};

const user: QueryResolvers['user'] = async (_, args, {prisma}, info) => {
  const select = createPrismaSelect(info);

  return prisma.user.findUnique({
    select,
    where: {id: args.id},
  }) as unknown as User;
};

const me: QueryResolvers['me'] = async (_, __, {userId, prisma}, info) => {
  assert(userId, 'Unauthorized');

  const select = createPrismaSelect(info);

  return prisma.user.findUnique({
    select,
    where: {id: userId},
  }) as unknown as User;
};

export default <Resolvers['Query']>{
  me,
  user,
  users,
};
