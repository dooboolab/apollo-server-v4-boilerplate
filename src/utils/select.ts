import {PrismaSelect} from '@paljs/plugins';
import type {GraphQLObjectType, GraphQLResolveInfo} from 'graphql';

type PrismaSelectType = Record<string, boolean> & {id: true};

export function createPrismaSelect(info: GraphQLResolveInfo): PrismaSelectType {
  const {select} = new PrismaSelect(info).value;

  if (select.edges) {
    /**
     * This is a workaround for the issue with PrismaSelect.
     * It does not filter out fields that are in connection fields.
     */
    const returnType = (info.returnType as GraphQLObjectType).name?.replace(
      'Connection',
      '',
    );

    const model = new PrismaSelect(info).dataModel.find(
      (el) => el.name === returnType,
    );
    const fieldNames = model?.fields.map((field) => field.name) || [];
    const selectObj = select.edges.select.node.select;

    for (const key in selectObj) {
      const value = selectObj[key];

      // Convert every nested field to `boolean` because filtering them are too complicated.
      if (typeof value != 'boolean') {
        selectObj[key] = true;
      }

      if (!fieldNames.includes(key)) {
        delete selectObj[key];
      }
    }

    return {
      ...selectObj,
      id: true,
    };
  }

  return {
    ...select,
    id: true,
  };
}
