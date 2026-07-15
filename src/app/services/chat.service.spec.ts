import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ChatService } from './chat.service';

const TOKEN_STORAGE_KEY = 'auth_token';

function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('getHistory requests the correct paginated URL', () => {
    service.getHistory(42).subscribe();

    const req = httpMock.expectOne('http://localhost:8080/chat/orders/42/messages?page=0&size=1000');
    expect(req.request.method).toBe('GET');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 1000 });
  });

  it('getHistory honors a custom page and size', () => {
    service.getHistory(42, 2, 20).subscribe();

    const req = httpMock.expectOne('http://localhost:8080/chat/orders/42/messages?page=2&size=20');
    req.flush({ content: [], totalElements: 0, totalPages: 0, number: 2, size: 20 });
  });

  it('starts in the idle connection state', () => {
    expect(service.connectionState()).toBe('idle');
  });

  it('disconnect resets connection state to idle without a prior connect', () => {
    service.disconnect();
    expect(service.connectionState()).toBe('idle');
  });
});