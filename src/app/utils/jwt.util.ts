/**
 * Decodes a JWT's payload without verifying its signature. Signature verification happens
 * server-side; this is only used client-side to read already-trusted claims (role, email, sub)
 * for UI decisions like menu visibility and route guards.
 */
export function decodeJwtPayload<T>(token: string): T | null {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4 || 4)) % 4), '=');
    const decoded = atob(padded);

    const json = decodeURIComponent(
      decoded
        .split('')
        .map(char => '%' + char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );

    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
