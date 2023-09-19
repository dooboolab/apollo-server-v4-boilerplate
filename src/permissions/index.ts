import {rule, shield} from 'graphql-shield';

const rules = {
  isAuthenticatedUser: rule()((_, __, {userId}) => {
    return Boolean(userId);
  }),
};

export const permissions = shield(
  {
    Query: {
      me: rules.isAuthenticatedUser,
    },
    Mutation: {},
  },
  {
    allowExternalErrors: process.env.NODE_ENV !== 'production',
  },
);
