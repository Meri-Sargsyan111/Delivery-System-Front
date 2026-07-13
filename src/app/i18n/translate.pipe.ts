import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from './translation.service';

/**
 * Impure so it re-evaluates on every change-detection pass of its view - required because
 * a language switch doesn't change the template's key/params arguments, only the service's
 * internal signal, which pure pipes wouldn't notice.
 */
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private i18n = inject(TranslationService);

  transform(key: string | null | undefined, params?: Record<string, string | number>): string {
    return key ? this.i18n.t(key, params) : '';
  }
}