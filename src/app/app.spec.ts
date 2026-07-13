import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the current section title in the toolbar, defaulting to Dashboard', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-toolbar-title')?.textContent).toContain('Dashboard');
  });
});

@Component({ standalone: true, selector: 'app-fake-login-page', template: 'login-page-marker' })
class FakeLoginPage {}

@Component({ standalone: true, selector: 'app-fake-dashboard', template: 'dashboard-marker' })
class FakeDashboard {}

describe('App - chromeless-to-full-layout navigation', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: '', component: FakeDashboard },
          { path: 'login', component: FakeLoginPage },
        ]),
      ],
    }).compileComponents();
  });

  it('keeps a single router-outlet and actually renders the target component after navigating from a chromeless route to a full-layout route', async () => {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(App);

    await router.navigateByUrl('/login');
    fixture.detectChanges();
    await fixture.whenStable();

    let outlets = fixture.nativeElement.querySelectorAll('router-outlet');
    expect(outlets.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('login-page-marker');

    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    outlets = fixture.nativeElement.querySelectorAll('router-outlet');
    expect(outlets.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('dashboard-marker');
  });
});
