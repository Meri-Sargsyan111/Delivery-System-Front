import { Component, inject } from '@angular/core';
import { AppLang } from '../../i18n/i18n.types';
import { TranslationService } from '../../i18n/translation.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  templateUrl: './language-switcher.html',
  styleUrl: './language-switcher.css',
})
export class LanguageSwitcher {

  private i18n = inject(TranslationService);

  languages = this.i18n.languages;
  activeLang = this.i18n.lang;

  selectLang(lang: AppLang): void {
    this.i18n.setLang(lang);
  }
}