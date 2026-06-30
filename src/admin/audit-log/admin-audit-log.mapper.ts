import { AdminAuditLog } from '../../entities/admin-audit-log.entity';

export type AdminAuditLogDto = {
  id: string;
  tenantId: string;
  adminId: string;
  action: string;
  method: string;
  path: string;
  statusCode: number | null;
  ipAddress: string | null;
  timestamp: string;
  details: Record<string, unknown>;
};

export function toAdminAuditLogDto(log: AdminAuditLog): AdminAuditLogDto {
  return {
    id: log.id,
    tenantId: log.tenantId,
    adminId: log.adminId,
    action: log.action || `${log.method} ${log.path}`,
    method: log.method,
    path: log.path,
    statusCode: log.statusCode,
    ipAddress: log.ipAddress,
    timestamp: log.createdAt.toISOString(),
    details: log.metadata || {},
  };
}

export function toAdminAuditLogListResponse(logs: AdminAuditLog[]) {
  return {
    data: logs.map(toAdminAuditLogDto),
    meta: { total: logs.length },
  };
}
