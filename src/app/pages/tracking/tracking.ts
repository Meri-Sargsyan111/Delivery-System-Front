import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tracking.html',
  styleUrls: ['./tracking.css']
})
export class Tracking {

  private http = inject(HttpClient);

  orderId = 0;
  events: any[] = [];

  trackOrder() {

    if (!this.orderId) {
      alert('Please enter Order ID');
      return;
    }

    this.http
      .get<any[]>(`http://localhost:8083/tracking/${this.orderId}`)
      .subscribe({
        next: (data) => {
          console.log(data);
          this.events = data;

          if (data.length === 0) {
            alert('No tracking events found');
          }
        },
        error: (err) => {
          console.error(err);
          alert('Tracking error');
        }
      });
  }
}
