import { Injectable } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {

  private client!: Client;

  connect(onMessage: (message: string) => void) {

    this.client = new Client({
      brokerURL: 'ws://localhost:8080/ws',
      reconnectDelay: 5000,

      onConnect: () => {

        console.log('✅ WebSocket Connected');

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
