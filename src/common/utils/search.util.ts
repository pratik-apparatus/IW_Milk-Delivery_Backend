import { SelectQueryBuilder, Brackets, ObjectLiteral } from 'typeorm';

export const applySearch = <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  search: string | undefined,
  fields: string[],
): SelectQueryBuilder<T> => {
  if (!search || !fields.length) {
    return queryBuilder;
  }

  queryBuilder.andWhere(
    new Brackets((qb) => {
      fields.forEach((field, index) => {
        const parameterName = `search_${index}`;
        if (index === 0) {
          qb.where(`${field} LIKE :${parameterName}`, {
            [parameterName]: `%${search}%`,
          });
        } else {
          qb.orWhere(`${field} LIKE :${parameterName}`, {
            [parameterName]: `%${search}%`,
          });
        }
      });
    }),
  );

  return queryBuilder;
};
