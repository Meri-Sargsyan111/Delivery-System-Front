import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../environments/environment';

export interface CourierLocation {
  orderId: number;
  latitude: number;
  longitude: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationWebSocketService {

  private client!: Client;

  connect(onLocation: (location: CourierLocation) => void): void {

    this.client = new Client({
      brokerURL: `${environment.wsBase}/ws-location`,
      reconnectDelay: 5000,

      onConnect: () => {

        this.client.subscribe('/topic/location', (message: IMessage) => {

          const location: CourierLocation = JSON.parse(message.body);

          onLocation(location);

        });

      }
    });

    this.client.activate();
  }

  disconnect(): void {
    if (this.client) {
      this.client.deactivate();
    }
  }
}
