import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './create-order.html',
  styleUrl: './create-order.css'
})
export class CreateOrder {

  customerName = '';
  fromAddress = '';
  toAddress = '';

  constructor(private http: HttpClient) {
  }

  createOrder() {

    const order = {
      customerName: this.customerName,
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      status: 'CREATED'
    };

    this.http.post(
      'http://localhost:8081/orders',
      order,
      {responseType: 'text'}
    )
      .subscribe({
        next: () => {
          alert('✅ Order created successfully!');

          this.customerName = '';
          this.fromAddress = '';
          this.toAddress = '';
        },
        error: (err) => {
          console.error(err);
        }
      });
  }

}
