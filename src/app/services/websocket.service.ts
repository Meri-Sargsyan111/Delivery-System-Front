import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {

  private client!: Client;

  connect(onMessage: (message: string) => void) {

    this.client = new Client({
      brokerURL: `${environment.wsBase}/ws`,
      reconnectDelay: 5000,

      onConnect: () => {

        this.client.subscribe('/topic/notifications', (message: IMessage) => {
          onMessage(message.body);
        });

      }
    });

    this.client.activate();
  }

  disconnect() {
    if (this.client) {
      this.client.deactivate();
    }
  }
}
