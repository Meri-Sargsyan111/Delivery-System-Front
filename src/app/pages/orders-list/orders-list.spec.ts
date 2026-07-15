import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { OrdersList } from './orders-list';

const TOKEN_STORAGE_KEY = 'auth_token';

/** Matches auth.service.spec.ts's helper - builds a fake (unsigned) JWT payload. */
function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

async function setUpWithRole(role: string | null): Promise<{ component: OrdersList; httpMock: HttpTestingController }> {
  sessionStorage.clear();
  if (role) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'user-1', role }));
  }

  await TestBed.configureTestingModule({
    imports: [OrdersList],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  }).compileComponents();

  const fixture = TestBed.createComponent(OrdersList);
  const component = fixture.componentInstance;
  const httpMock = TestBed.inject(HttpTestingController);

  httpMock.expectOne('http://localhost:8080/orders?size=1000')
    .flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 });
  httpMock.expectOne('http://localhost:8080/courier')
    .flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });

  await fixture.whenStable();
  return { component, httpMock };
}

describe('OrdersList', () => {
  let component: OrdersList;
  let fixture: ComponentFixture<OrdersList>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrdersList],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(OrdersList);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    httpMock.expectOne('http://localhost:8080/orders?size=1000')
      .flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 });
    httpMock.expectOne('http://localhost:8080/courier')
    .flush({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 });

    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('OrdersList - chat visibility rule', () => {
  afterEach(() => {
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.verify();
    sessionStorage.clear();
  });

  it('CUSTOMER can chat', async () => {
    const { component } = await setUpWithRole('ROLE_CUSTOMER');
    expect(component.canChat()).toBe(true);
  });

  it('COURIER can chat', async () => {
    const { component } = await setUpWithRole('ROLE_COURIER');
    expect(component.canChat()).toBe(true);
  });

  it('ADMIN cannot chat (read-only access exists at the API level only)', async () => {
    const { component } = await setUpWithRole('ROLE_ADMIN');
    expect(component.canChat()).toBe(false);
  });
});
