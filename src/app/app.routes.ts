import { Routes } from '@angular/router';

import { OrdersList } from './pages/orders-list/orders-list';
import { CreateOrder } from './pages/create-order/create-order';
import { Dashboard } from './pages/dashboard/dashboard';
import { Tracking } from './pages/tracking/tracking';
import { Notifications } from './pages/notifications/notifications';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard
  },
  {
    path: 'orders',
    component: OrdersList
  },
  {
    path: 'create-order',
    component: CreateOrder
  },
  {
    path: 'tracking',
    component: Tracking
  },
  {
    path: 'notifications',
    component: Notifications
  }
];
