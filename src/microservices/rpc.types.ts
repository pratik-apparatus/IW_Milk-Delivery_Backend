export interface RpcEnvelope<T = unknown> {
  token: string;
  tenantId?: string;
  data: T;
}
