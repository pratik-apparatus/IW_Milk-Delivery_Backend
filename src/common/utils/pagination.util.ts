import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const applyPagination = async <T extends ObjectLiteral>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number = 1,
  limit: number = 20,
): Promise<PaginationResult<T>> => {
  const maxLimit = 100;
  const safeLimit = Math.min(limit, maxLimit);
  const skip = (page - 1) * safeLimit;

  queryBuilder.skip(skip).take(safeLimit);

  const [data, total] = await queryBuilder.getManyAndCount();

  return {
    data,
    meta: {
      total,
      page,
      limit: safeLimit,
    },
  };
};
