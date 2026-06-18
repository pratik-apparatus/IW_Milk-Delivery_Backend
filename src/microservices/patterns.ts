/** Keep in sync across backend, authServices, and mailServices repos. */
export const BackendPatterns = {
  AUTH_GET_LOGIN_DATA: { cmd: 'backend.auth.getLoginData' },
  AUTH_GET_ADMIN_LOGIN_DATA: { cmd: 'backend.auth.getAdminLoginData' },
  AUTH_VALIDATE_EMAIL: { cmd: 'backend.auth.validateEmail' },
  AUTH_UPDATE_PASSWORD: { cmd: 'backend.auth.updatePassword' },
  AUTH_ISSUE_REFRESH_TOKEN: { cmd: 'backend.auth.issueRefreshToken' },
  AUTH_ROTATE_REFRESH_TOKEN: { cmd: 'backend.auth.rotateRefreshToken' },
  CUSTOMER_FIND_OR_CREATE: { cmd: 'backend.customer.findOrCreate' },
  CUSTOMER_GET_AUTH_DATA: { cmd: 'backend.customer.getAuthData' },
  ADMIN_CREATE: { cmd: 'backend.admin.create' },
} as const;

export const MailPatterns = {
  SEND_PASSWORD_RESET: { cmd: 'mail.sendPasswordReset' },
  SEND_TENANT_CREDENTIALS: { cmd: 'mail.sendTenantCredentials' },
  NOTIFICATION_SEND: { cmd: 'mail.notification.send' },
  NOTIFICATION_SEND_BULK: { cmd: 'mail.notification.sendBulk' },
  NOTIFICATION_SEND_CUSTOM: { cmd: 'mail.notification.sendCustom' },
} as const;

export const BACKEND_MS_CLIENT = 'BACKEND_MS_CLIENT';
export const MAIL_MS_CLIENT = 'MAIL_MS_CLIENT';
