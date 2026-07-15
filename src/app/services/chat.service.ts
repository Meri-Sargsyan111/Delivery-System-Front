import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { AuthService } from './auth.service';
import { PageResponse } from './order.service';
import { environment } from '../../environments/environment';

const CHAT_API_BASE = `${environment.apiBase}/chat`;
const CHAT_WS_URL = `${environment.wsBase}/ws-chat`;

export interface ChatMessage {
  id: number;
  orderId: number;
  senderUserId: string;
  senderRole: 'ROLE_CUSTOMER' | 'ROLE_COURIER' | string;
  content: string;
  sentAt: string;
}

export type ChatConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'denied';

@Injectable({ providedIn: 'root' })
export class ChatService {

  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private client: Client | null = null;
  private subscription: StompSubscription | null = null;
  private errorSubscription: StompSubscription | null = null;

  connectionState = signal<ChatConnectionState>('idle');

  /** Defaults to a page size large enough to cover a full chat history rather than the
   *  backend's default of 20 - the component never overrides this, so a small default
   *  here would silently drop older messages, same as the order-service fix. */
  getHistory(orderId: number, page = 0, size = 1000): Observable<PageResponse<ChatMessage>> {
    return this.http.get<PageResponse<ChatMessage>>(
      `${CHAT_API_BASE}/orders/${orderId}/messages?page=${page}&size=${size}`
    );
  }

  /**
   * Opens the STOMP connection and subscribes to the order's chat topic. The JWT travels
   * as a STOMP CONNECT header (connectHeaders), not an HTTP header - see chat-service's
   * ChatChannelInterceptor for why this is the real, backend-enforced authorization
   * boundary, not just a frontend convenience: a forged orderId or a non-participant's
   * token is rejected server-side regardless of what this client does.
   */
  connect(orderId: number, onMessage: (message: ChatMessage) => void, onDenied: (reason: string) => void): void {
    this.disconnect();
    this.connectionState.set('connecting');

    const token = this.authService.getToken();

    this.client = new Client({
      brokerURL: CHAT_WS_URL,
      connectHeaders: { Authorization: `Bearer ${token ?? ''}` },
      reconnectDelay: 5000,
      onConnect: () => {
        this.connectionState.set('connected');

        this.subscription = this.client!.subscribe(`/topic/chat/order/${orderId}`, (msg: IMessage) => {
          onMessage(JSON.parse(msg.body) as ChatMessage);
        });

        this.errorSubscription = this.client!.subscribe('/user/queue/chat/errors', (msg: IMessage) => {
          const body = JSON.parse(msg.body) as { message: string };
          onDenied(body.message);
        });
      },
      onWebSocketClose: () => {
        if (this.connectionState() === 'connected') {
          this.connectionState.set('reconnecting');
        }
      },
      onStompError: (frame) => {
        this.connectionState.set('denied');
        onDenied(frame.headers['message'] ?? 'Access to this chat was denied.');
      },
    });

    this.client.activate();
  }

  send(orderId: number, content: string): void {
    if (!this.client?.connected) {
      return;
    }
    this.client.publish({
      destination: `/app/chat/${orderId}`,
      body: JSON.stringify({ content }),
    });
  }

  disconnect(): void {
    this.subscription?.unsubscribe();
    this.errorSubscription?.unsubscribe();
    this.subscription = null;
    this.errorSubscription = null;

    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.connectionState.set('idle');
  }
}