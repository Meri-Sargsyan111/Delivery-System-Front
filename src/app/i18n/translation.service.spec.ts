import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

const LANG_STORAGE_KEY = 'app_lang';
const TOKEN_STORAGE_KEY = 'auth_token';

describe('TranslationService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to English when no language has been selected and the browser locale is not hy/ru', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.lang()).toBe('en');
    expect(service.t('nav.dashboard')).toBe('Dashboard');
  });

  it('switches to Armenian and updates translated text', () => {
    const service = TestBed.inject(TranslationService);

    service.setLang('hy');

    expect(service.lang()).toBe('hy');
    expect(service.t('nav.dashboard')).toBe('Գլխավոր վահանակ');
  });

  it('switches to Russian and updates translated text', () => {
    const service = TestBed.inject(TranslationService);

    service.setLang('ru');

    expect(service.lang()).toBe('ru');
    expect(service.t('nav.dashboard')).toBe('Панель управления');
  });

  it('switches back to English after switching away', () => {
    const service = TestBed.inject(TranslationService);

    service.setLang('ru');
    service.setLang('en');

    expect(service.lang()).toBe('en');
    expect(service.t('nav.dashboard')).toBe('Dashboard');
  });

  it('persists the selected language across a simulated page refresh', () => {
    const first = TestBed.inject(TranslationService);
    first.setLang('hy');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const second = TestBed.inject(TranslationService);

    expect(second.lang()).toBe('hy');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('hy');
  });

  it('stores the language under its own key and never touches the auth token key', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'some-jwt-token');
    const service = TestBed.inject(TranslationService);

    service.setLang('ru');

    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('ru');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('some-jwt-token');
  });

  it('interpolates params into the translated template', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('orders.totalOrders', { count: 5 })).toBe('Total Orders: 5');

    service.setLang('ru');
    expect(service.t('orders.totalOrders', { count: 5 })).toBe('Всего заказов: 5');
  });

  it('falls back to English, then the raw key, for missing translations', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
  });

  it('translates order status enum values without altering the underlying value', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('status.order.IN_PROGRESS')).toBe('In Progress');
    service.setLang('hy');
    expect(service.t('status.order.IN_PROGRESS')).toBe('Ընթացքի մեջ');
    service.setLang('ru');
    expect(service.t('status.order.IN_PROGRESS')).toBe('В процессе');
  });

  it('translates courier availability labels', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('status.courier.AVAILABLE')).toBe('Available');
    service.setLang('hy');
    expect(service.t('status.courier.AVAILABLE')).toBe('Հասանելի');
    service.setLang('ru');
    expect(service.t('status.courier.AVAILABLE')).toBe('Доступен');
  });

  it('translates chat UI strings', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('chat.typeMessage')).toBe('Type a message…');
    service.setLang('ru');
    expect(service.t('chat.typeMessage')).toBe('Введите сообщение…');
  });

  it('translates tracking UI strings', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('tracking.trackOrder')).toBe('Track Order');
    service.setLang('hy');
    expect(service.t('tracking.trackOrder')).toBe('Հետևել պատվերին');
  });

  it('translates live tracking labels', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('liveTracking.waitingForLocation')).toBe('Waiting for location…');
    service.setLang('ru');
    expect(service.t('liveTracking.waitingForLocation')).toBe('Ожидание местоположения…');
  });

  it('translates shared HTTP error states', () => {
    const service = TestBed.inject(TranslationService);

    expect(service.t('errors.network')).toBe('Network error. Please check your connection and try again.');
    expect(service.t('errors.forbidden')).toBe('You do not have permission to perform this action.');
    service.setLang('hy');
    expect(service.t('errors.network')).toBe('Ցանցային սխալ։ Ստուգեք կապն ու փորձեք կրկին։');
  });
});