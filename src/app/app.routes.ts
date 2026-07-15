import { Routes } from '@angular/router';

import { OrdersList } from './pages/orders-list/orders-list';
import { CreateOrder } from './pages/create-order/create-order';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tracking } from './pages/tracking/tracking';
import { Notifications } from './pages/notifications/notifications';
import { LiveTracking } from './pages/live-tracking/live-tracking';
import { Couriers } from './pages/couriers/couriers';
import { Profile } from './pages/profile/profile';
import { Chat } from './pages/chat/chat';
import { AuthLayout } from './layouts/auth-layout/auth-layout';
import { Login } from './pages/auth/login/login';
import { Register } from './pages/auth/register/register';
import { About } from './pages/about/about';
import { HowItWorks } from './pages/how-it-works/how-it-works';
import { Technologies } from './pages/technologies/technologies';
import { Splash } from './pages/splash/splash';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';
import { splashGuard } from './guards/splash-guard';

export const routes: Routes = [
  {
    path: 'splash',
    component: Splash
  },
  {
    path: '',
    component: Dashboard,
    canActivate: [splashGuard, authGuard]
  },
  {
    path: 'orders',
    component: OrdersList,
    canActivate: [authGuard]
  },
  {
    path: 'create-order',
    component: CreateOrder,
    canActivate: [authGuard, roleGuard(['ROLE_ADMIN', 'ROLE_CUSTOMER'])]
  },
  {
    path: 'tracking',
    component: Tracking,
    canActivate: [authGuard]
  },
  {
    path: 'notifications',
    component: Notifications,
    canActivate: [authGuard]
  },
  {
    path: 'live-tracking',
    component: LiveTracking,
    canActivate: [authGuard]
  },
  {
    path: 'couriers',
    component: Couriers,
    canActivate: [authGuard, roleGuard(['ROLE_ADMIN'])]
  },
  {
    path: 'profile',
    component: Profile,
    canActivate: [authGuard]
  },
  {
    path: 'orders/:orderId/chat',
    component: Chat,
    canActivate: [authGuard, roleGuard(['ROLE_CUSTOMER', 'ROLE_COURIER'])]
  },
  {
    path: 'about',
    component: About
  },
  {
    path: 'how-it-works',
    component: HowItWorks
  },
  {
    path: 'technologies',
    component: Technologies
  },
  {
    path: '',
    component: AuthLayout,
    children: [
      {
        path: 'login',
        component: Login
      },
      {
        path: 'register',
        component: Register
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
