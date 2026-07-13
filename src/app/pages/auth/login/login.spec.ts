import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Login } from './login';
import { AUTH_API_BASE } from '../../../services/auth.service';
import { TranslationService } from '../../../i18n/translation.service';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function submitWithBadPassword() {
    component.form.setValue({ email: 'user@example.com', password: 'wrongpass', rememberMe: false });
    component.onSubmit();
    httpMock.expectOne(`${AUTH_API_BASE}/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
  }

  it('shows the English fallback message by default when the backend returns no message', () => {
    submitWithBadPassword();
    expect(component.errorMessage()).toBe('Invalid email or password. Please try again.');
  });

  it('regression: the fallback error message re-translates immediately when the language changes afterwards', () => {
    const i18n = TestBed.inject(TranslationService);

    submitWithBadPassword();
    expect(component.errorMessage()).toBe('Invalid email or password. Please try again.');

    i18n.setLang('hy');
    expect(component.errorMessage()).toBe('Սխալ էլ. հասցե կամ գաղտնաբառ։ Փորձեք կրկին։');

    i18n.setLang('ru');
    expect(component.errorMessage()).toBe('Неверный адрес электронной почты или пароль. Попробуйте снова.');

    i18n.setLang('en');
    expect(component.errorMessage()).toBe('Invalid email or password. Please try again.');
  });

  it('never translates a raw backend-supplied error message, regardless of active language', () => {
    const i18n = TestBed.inject(TranslationService);
    i18n.setLang('ru');

    component.form.setValue({ email: 'user@example.com', password: 'wrongpass', rememberMe: false });
    component.onSubmit();
    httpMock.expectOne(`${AUTH_API_BASE}/login`).flush({ message: 'Account locked' }, { status: 401, statusText: 'Unauthorized' });

    expect(component.errorMessage()).toBe('Account locked');

    i18n.setLang('hy');
    expect(component.errorMessage()).toBe('Account locked');
  });
});