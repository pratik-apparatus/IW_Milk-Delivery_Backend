// common/utils/period-grouping.util.ts
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

export function getPeriodSelectAndGroup(
    period: ReportPeriod,
    columnAlias: string = 'createdAt'
): PeriodConfig {
    switch (period) {
        case ReportPeriod.YEARLY:
            return {
                select: `DATE_FORMAT(${columnAlias}, '%Y')`,
                groupBy: `DATE_FORMAT(${columnAlias}, '%Y')`,
                label: 'year',
            };
        case ReportPeriod.MONTHLY:
            return {
                select: `DATE_FORMAT(${columnAlias}, '%Y-%m')`,
                groupBy: `DATE_FORMAT(${columnAlias}, '%Y-%m')`,
                label: 'month',
            };
        case ReportPeriod.WEEKLY:
            return {
                select: `YEARWEEK(${columnAlias}, 1)`,
                groupBy: `YEARWEEK(${columnAlias}, 1)`,
                label: 'week',
            };
        case ReportPeriod.DAILY:
        default:
            return {
                select: `DATE(${columnAlias})`,
                groupBy: `DATE(${columnAlias})`,
                label: 'date',
            };
    }
}