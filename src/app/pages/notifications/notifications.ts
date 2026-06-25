import { Component, inject, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { WebSocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrls: ['./notifications.css']
})
export class Notifications implements OnDestroy {

  private http = inject(HttpClient);
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

    this.http
      .get<string[]>('http://localhost:8080/notifications')
      .subscribe({
        next: (data) => {

          console.log('NOTIFICATIONS DATA:', data);

          this.notifications = [...data];

          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

  ngOnDestroy(): void {
    this.webSocketService.disconnect();
  }
}
