import type {CodegenConfig} from '@graphql-codegen/cli';

export default <CodegenConfig>{
  schema: './schemas/schema.graphql',
  documents: undefined,
  overwrite: true,
  emitLegacyCommonJSImports: false,
  generates: {
    './src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-resolvers',
        'typescript-operations',
        'typed-document-node',
      ],
      config: {
        useIndexSignature: true,
        contextType: '../context.js#Context',
        allowParentTypeOverride: true,
        // https://github.com/dotansimha/graphql-code-generator/issues/2932#issuecomment-582862732
        mapperTypeSuffix: 'Model',
        scalars: {
          // Note: without below configuration, ID will be mapped to string or number.
          ID: 'string',
        },
        enumValues: {
          AuthType: '@prisma/client#AuthType',
          Gender: '@prisma/client#Gender',
        },
        mappers: {
          // https://github.com/dotansimha/graphql-code-generator/issues/1793#issuecomment-488302686
          User: '@prisma/client#User',
          File: '@prisma/client#File',
          Image: '@prisma/client#Image',
        },
        inputMaybeValue: 'T | undefined | null',
        defaultMapper: 'Partial<{T}>',
      },
    },
  },
};
