import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrls: ['./notifications.css']
})
export class Notifications {

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);

  notifications: string[] = [];

  constructor() {
    this.loadNotifications();
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
}
