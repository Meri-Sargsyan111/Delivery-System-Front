import { Component, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { WebSocketService } from '../../services/websocket.service';
import { NotificationService } from '../../services/notification.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
})
export class Notifications implements OnDestroy {
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private webSocketService = inject(WebSocketService);

  notifications: string[] = [];

  constructor() {
    this.loadNotifications();

    this.webSocketService.connect((message: string) => {
      this.notifications.unshift(message);

      this.cdr.detectChanges();
    });
  }

  loadNotifications() {
    this.notificationService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = data.content ?? [];

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Notification load failed:', err);
      },
    });
  }

  ngOnDestroy(): void {
    this.webSocketService.disconnect();
  }
}
