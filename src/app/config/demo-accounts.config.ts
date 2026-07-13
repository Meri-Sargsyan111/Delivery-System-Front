/**
 * Single source of truth for the "Quick Demo Login" credentials shown on the login page.
 * Replace the placeholder email/password pairs below with real demo accounts once they exist;
 * nothing else needs to change.
 */
export type DemoAccountRole = 'admin' | 'courier' | 'customer';

export interface DemoAccount {
  role: DemoAccountRole;
  icon: string;
  email: string;
  password: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'admin',
    icon: '👑',
    email: 'admin@delivery.com',
    password: 'Admin@12345',
  },
  {
    role: 'courier',
    icon: '🚚',
    email: 'courier@delivery.com',
    password: 'Courier@12345',
  },
  {
    role: 'customer',
    icon: '👤',
    email: 'customer@delivery.com',
    password: 'Customer@12345',
  },
];
