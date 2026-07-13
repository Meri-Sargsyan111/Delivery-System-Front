import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { Chat } from './chat';
import { ChatService, ChatMessage, ChatConnectionState } from '../../services/chat.service';
import { OrderService, Order } from '../../services/order.service';

const TOKEN_STORAGE_KEY = 'auth_token';

function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

const SAMPLE_ORDER: Order = {
  id: 7,
  customerName: 'Test Customer',
  customerPhone: '+1234567',
  fromAddress: 'A St',
  toAddress: 'B Ave',
  status: 'IN_PROGRESS',
  courierId: 3,
};

const DELIVERED_ORDER: Order = { ...SAMPLE_ORDER, status: 'DELIVERED' };

describe('Chat', () => {
  let fixture: ComponentFixture<Chat>;
  let component: Chat;
  let chatServiceMock: {
    getHistory: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    connectionState: ReturnType<typeof signal<ChatConnectionState>>;
  };
  let orderServiceMock: { getOrder: ReturnType<typeof vi.fn> };
  let onMessageCallback: ((message: ChatMessage) => void) | null;
  let onDeniedCallback: ((reason: string) => void) | null;

  function setUp(historyResult: 'ok' | 403 | 409 | 500, order: Order = SAMPLE_ORDER) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'customer-1', role: 'ROLE_CUSTOMER' }));

    onMessageCallback = null;
    onDeniedCallback = null;

    chatServiceMock = {
      getHistory: vi.fn(),
      connect: vi.fn((_orderId: number, onMessage: (m: ChatMessage) => void, onDenied: (r: string) => void) => {
        onMessageCallback = onMessage;
        onDeniedCallback = onDenied;
      }),
      send: vi.fn(),
      disconnect: vi.fn(),
      connectionState: signal<ChatConnectionState>('idle'),
    };
    orderServiceMock = { getOrder: vi.fn(() => of(order)) };

    if (historyResult === 'ok') {
      chatServiceMock.getHistory.mockReturnValue(of({
        content: [{ id: 1, orderId: 7, senderUserId: 'customer-1', senderRole: 'ROLE_CUSTOMER', content: 'hi', sentAt: '2026-01-01T00:00:00' }],
        totalElements: 1, totalPages: 1, number: 0, size: 50,
      }));
    } else {
      chatServiceMock.getHistory.mockReturnValue(throwError(() => ({ status: historyResult, error: { message: 'nope' } })));
    }

    TestBed.configureTestingModule({
      imports: [Chat],
      providers: [
        provideRouter([]),
        { provide: ChatService, useValue: chatServiceMock },
        { provide: OrderService, useValue: orderServiceMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['orderId', '7']]) } },
        },
      ],
    });

    fixture = TestBed.createComponent(Chat);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    sessionStorage.clear();
    onMessageCallback = null;
    onDeniedCallback = null;
  });

  it('loads history and moves to the ready state', () => {
    setUp('ok');
    fixture.detectChanges();

    expect(component.viewState()).toBe('ready');
    expect(component.messages().length).toBe(1);
    expect(chatServiceMock.connect).toHaveBeenCalled();
  });

  it('a 403 from history moves to the denied state and does not connect the socket', () => {
    setUp(403);
    fixture.detectChanges();

    expect(component.viewState()).toBe('denied');
    expect(chatServiceMock.connect).not.toHaveBeenCalled();
  });

  it('a 409 from history moves to the unavailable state (no courier assigned yet)', () => {
    setUp(409);
    fixture.detectChanges();

    expect(component.viewState()).toBe('unavailable');
  });

  it('a 500 from history moves to a generic error state', () => {
    setUp(500);
    fixture.detectChanges();

    expect(component.viewState()).toBe('error');
  });

  it('receiving a real-time message appends it to the list', () => {
    setUp('ok');
    fixture.detectChanges();

    const incoming: ChatMessage = {
      id: 2, orderId: 7, senderUserId: 'courier-1', senderRole: 'ROLE_COURIER',
      content: 'on my way', sentAt: '2026-01-01T00:01:00',
    };
    onMessageCallback!(incoming);

    expect(component.messages().length).toBe(2);
    expect(component.messages()[1].content).toBe('on my way');
  });

  it('a WebSocket denial surfaces as a send error', () => {
    setUp('ok');
    fixture.detectChanges();

    onDeniedCallback!('Order 7 has reached a terminal state');

    expect(component.sendError()).toBe('Order 7 has reached a terminal state');
  });

  it('send() trims and forwards the draft, then clears the input', () => {
    setUp('ok');
    fixture.detectChanges();

    component.draft = '  Hello, where are you?  ';
    component.send();

    expect(chatServiceMock.send).toHaveBeenCalledWith(7, 'Hello, where are you?');
    expect(component.draft).toBe('');
  });

  it('send() does nothing for a blank draft', () => {
    setUp('ok');
    fixture.detectChanges();

    component.draft = '   ';
    component.send();

    expect(chatServiceMock.send).not.toHaveBeenCalled();
  });

  it('isOwnMessage distinguishes sender from the other party', () => {
    setUp('ok');
    fixture.detectChanges();

    expect(component.isOwnMessage({ id: 1, orderId: 7, senderUserId: 'customer-1', senderRole: 'ROLE_CUSTOMER', content: 'x', sentAt: '' })).toBe(true);
    expect(component.isOwnMessage({ id: 2, orderId: 7, senderUserId: 'courier-1', senderRole: 'ROLE_COURIER', content: 'x', sentAt: '' })).toBe(false);
  });

  it('disconnects the socket on destroy', () => {
    setUp('ok');
    fixture.detectChanges();

    fixture.destroy();

    expect(chatServiceMock.disconnect).toHaveBeenCalled();
  });

  it('disables sending once the order is DELIVERED, even while connected', () => {
    setUp('ok', DELIVERED_ORDER);
    fixture.detectChanges();
    chatServiceMock.connectionState.set('connected');

    expect(component.isOrderTerminal()).toBe(true);
    expect(component.canSend()).toBe(false);

    component.draft = 'still here?';
    component.send();

    expect(chatServiceMock.send).not.toHaveBeenCalled();
  });

  it('allows sending on a non-terminal order once connected', () => {
    setUp('ok');
    fixture.detectChanges();
    chatServiceMock.connectionState.set('connected');

    expect(component.isOrderTerminal()).toBe(false);
    expect(component.canSend()).toBe(true);
  });
});