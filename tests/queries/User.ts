import {gql} from 'graphql-tag';

export const userQuery = gql`
  query UserQuery($id: ID!) {
    user(id: $id) {
      id
      email
    }
  }
`;

export const usersQuery = gql`
  query UserPaginationQuery($first: Int!, $after: String, $searchText: String) {
    users(first: $first, after: $after, searchText: $searchText) {
      edges {
        cursor
        node {
          id
          email
        }
      }
    }
  }
`;
