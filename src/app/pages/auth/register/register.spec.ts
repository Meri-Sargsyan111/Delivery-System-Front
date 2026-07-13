import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Register } from './register';
import { AUTH_API_BASE } from '../../../services/auth.service';
import { TranslationService } from '../../../i18n/translation.service';

@Component({ template: '' })
class LoginStub {}

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([{ path: 'login', component: LoginStub }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  function fillCommonFields() {
    component.form.patchValue({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phoneNumber: '+37499123456',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
    });
  }

  it('defaults the role selector to CUSTOMER', () => {
    expect(component.role.value).toBe('CUSTOMER');
  });

  it('sends role: "CUSTOMER" in the register payload when Customer is selected (default)', () => {
    fillCommonFields();

    component.onSubmit();

    const req = httpMock.expectOne(`${AUTH_API_BASE}/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.role).toBe('CUSTOMER');
    expect(req.request.body).toEqual({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phoneNumber: '+37499123456',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      role: 'CUSTOMER',
    });

    req.flush({ accessToken: 'token' });
  });

  it('sends role: "COURIER" in the register payload after selecting Courier', () => {
    fillCommonFields();
    component.selectRole('COURIER');

    component.onSubmit();

    const req = httpMock.expectOne(`${AUTH_API_BASE}/register`);
    expect(req.request.body.role).toBe('COURIER');

    req.flush({ accessToken: 'token' });
  });

  it('does not submit when the form is invalid', () => {
    component.onSubmit();

    httpMock.expectNone(`${AUTH_API_BASE}/register`);
    expect(component.submitted).toBe(true);
  });

  it('surfaces the backend error message and resets the submitting state on failure', () => {
    fillCommonFields();

    component.onSubmit();

    const req = httpMock.expectOne(`${AUTH_API_BASE}/register`);
    req.flush({ message: 'Email already registered' }, { status: 409, statusText: 'Conflict' });

    expect(component.isSubmitting()).toBe(false);
    expect(component.errorMessage()).toBe('Email already registered');
  });

  it('regression: the fallback registration-failure message re-translates immediately when the language changes afterwards', () => {
    const i18n = TestBed.inject(TranslationService);

    fillCommonFields();
    component.onSubmit();

    const req = httpMock.expectOne(`${AUTH_API_BASE}/register`);
    req.flush({}, { status: 500, statusText: 'Internal Server Error' });

    expect(component.errorMessage()).toBe('Registration failed. Please try again.');

    i18n.setLang('hy');
    expect(component.errorMessage()).toBe('Գրանցումը ձախողվեց։ Փորձեք կրկին։');

    i18n.setLang('ru');
    expect(component.errorMessage()).toBe('Не удалось зарегистрироваться. Попробуйте снова.');
  });

  it('never translates a raw backend-supplied registration error, regardless of active language', () => {
    const i18n = TestBed.inject(TranslationService);
    i18n.setLang('ru');

    fillCommonFields();
    component.onSubmit();

    const req = httpMock.expectOne(`${AUTH_API_BASE}/register`);
    req.flush({ message: 'Email already registered' }, { status: 409, statusText: 'Conflict' });

    expect(component.errorMessage()).toBe('Email already registered');

    i18n.setLang('hy');
    expect(component.errorMessage()).toBe('Email already registered');
  });
});
