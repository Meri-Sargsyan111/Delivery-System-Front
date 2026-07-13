import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageSwitcher } from './language-switcher';
import { TranslationService } from '../../i18n/translation.service';

describe('LanguageSwitcher', () => {
  let fixture: ComponentFixture<LanguageSwitcher>;
  let i18n: TranslationService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguageSwitcher);
    i18n = TestBed.inject(TranslationService);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders all three languages with English active by default', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.lang-option');

    expect(buttons.length).toBe(3);
    expect(Array.from(buttons).map(b => b.textContent?.trim())).toEqual(['English', 'Հայերեն', 'Русский']);

    const active = fixture.nativeElement.querySelector('.lang-option.active') as HTMLButtonElement;
    expect(active.textContent?.trim()).toBe('English');
  });

  it('switches the active language immediately when a button is clicked, without a page reload', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.lang-option');
    const armenianButton = Array.from(buttons).find(b => b.textContent?.trim() === 'Հայերեն')!;

    armenianButton.click();
    fixture.detectChanges();

    expect(i18n.lang()).toBe('hy');
    const active = fixture.nativeElement.querySelector('.lang-option.active') as HTMLButtonElement;
    expect(active.textContent?.trim()).toBe('Հայերեն');
  });
});