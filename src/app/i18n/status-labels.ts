import { AppRole } from '../services/auth.service';

/**
 * These return translation KEYS (not translated text) for backend enum values, so
 * templates can pipe the result through the `t` pipe - e.g. `{{ orderStatusKey(o.status) | t }}`.
 * The raw enum values themselves (CREATED, ASSIGNED, ...) must never be altered; only their
 * displayed label changes with the active language.
 */
export function orderStatusKey(status: string | null | undefined): string {
  return status ? `status.order.${status}` : '';
}

export function courierStatusKey(status: string | null | undefined): string {
  return status ? `status.courier.${status}` : '';
}

export function roleTranslationKey(role: AppRole | string | null | undefined): string {
  switch (role) {
    case 'ROLE_ADMIN':
      return 'roles.admin';
    case 'ROLE_CUSTOMER':
      return 'roles.customer';
    case 'ROLE_COURIER':
      return 'roles.courier';
    default:
      return 'roles.user';
  }
}