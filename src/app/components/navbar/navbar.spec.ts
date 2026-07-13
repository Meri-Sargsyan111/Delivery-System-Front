import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Navbar } from './navbar';
import { TranslationService } from '../../i18n/translation.service';

const TOKEN_STORAGE_KEY = 'auth_token';

/** Matches auth.service.spec.ts's helper - builds a fake (unsigned) JWT payload. */
function fakeToken(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${encode({ alg: 'RS256' })}.${encode(payload)}.fake-signature`;
}

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders English nav labels by default', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Dashboard');
    expect(text).toContain('Orders');
    expect(text).toContain('Profile');
  });

  it('re-renders nav labels in Armenian when the language changes, without a page reload', () => {
    fixture.detectChanges();

    const i18n = TestBed.inject(TranslationService);
    i18n.setLang('hy');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Գլխավոր վահանակ');
    expect(text).toContain('Պատվերներ');
  });

  it('re-renders nav labels in Russian when the language changes', () => {
    fixture.detectChanges();

    const i18n = TestBed.inject(TranslationService);
    i18n.setLang('ru');
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Панель управления');
    expect(text).toContain('Заказы');
  });
});

describe('Navbar - role-based navigation translation', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  async function renderAs(role: string): Promise<ComponentFixture<Navbar>> {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(TOKEN_STORAGE_KEY, fakeToken({ sub: 'user-1', role }));

    await TestBed.configureTestingModule({
      imports: [Navbar],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(Navbar);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('shows Create Order and hides Couriers for CUSTOMER', async () => {
    const fixture = await renderAs('ROLE_CUSTOMER');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Create Order');
    expect(text).not.toContain('Couriers');
  });

  it('shows Create Order and Couriers for ADMIN', async () => {
    const fixture = await renderAs('ROLE_ADMIN');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Create Order');
    expect(text).toContain('Couriers');
  });

  it('hides Create Order and Couriers for COURIER', async () => {
    const fixture = await renderAs('ROLE_COURIER');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).not.toContain('Create Order');
    expect(text).not.toContain('Couriers');
  });
});
