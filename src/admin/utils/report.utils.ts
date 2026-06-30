export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export interface PeriodConfig {
  select: string;
  groupBy: string;
  label: string;
}

/** Quote table.column for PostgreSQL camelCase columns (createdAt -> "createdAt"). */
function quotePgColumn(columnAlias: string): string {
  if (columnAlias.includes('"')) {
    return columnAlias;
  }

  const parts = columnAlias.split('.');
  if (parts.length === 2) {
    return `${parts[0]}."${parts[1]}"`;
  }

  return `"${columnAlias}"`;
}

export function getPeriodSelectAndGroup(
  period: ReportPeriod,
  columnAlias: string = 'createdAt',
): PeriodConfig {
  const col = quotePgColumn(columnAlias);

  switch (period) {
    case ReportPeriod.YEARLY:
      return {
        select: `TO_CHAR(${col}, 'YYYY')`,
        groupBy: `TO_CHAR(${col}, 'YYYY')`,
        label: 'year',
      };
    case ReportPeriod.MONTHLY:
      return {
        select: `TO_CHAR(${col}, 'YYYY-MM')`,
        groupBy: `TO_CHAR(${col}, 'YYYY-MM')`,
        label: 'month',
      };
    case ReportPeriod.WEEKLY:
      return {
        select: `TO_CHAR(${col}, 'IYYY-IW')`,
        groupBy: `TO_CHAR(${col}, 'IYYY-IW')`,
        label: 'week',
      };
    case ReportPeriod.DAILY:
    default:
      return {
        select: `DATE(${col})`,
        groupBy: `DATE(${col})`,
        label: 'date',
      };
  }
}
