import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n/translation.service';
import { DEMO_ACCOUNTS, DemoAccount } from '../../../config/demo-accounts.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  submitted = false;
  isSubmitting = signal(false);

  readonly demoAccounts = DEMO_ACCOUNTS;

  /**
   * A backend-supplied message is raw text and must never be translated. A frontend
   * fallback, however, must stay reactive to a later language switch - so it's kept as a
   * translation key here and only resolved to text inside this computed, which re-runs
   * whenever the active language changes (unlike a plain string captured once at error time).
   */
  private serverErrorMessage = signal<string | null>(null);
  private fallbackErrorKey = signal<string | null>(null);
  errorMessage = computed(() => this.serverErrorMessage() ?? (this.fallbackErrorKey() ? this.i18n.t(this.fallbackErrorKey()!) : null));

  form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required, Validators.minLength(6)]),
    rememberMe: this.fb.control(false)
  });

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  /** Autofills credentials only - the user must still submit the form manually. */
  fillDemoAccount(account: DemoAccount) {
    this.form.patchValue({
      email: account.email,
      password: account.password
    });
  }

  onSubmit() {
    this.submitted = true;
    this.serverErrorMessage.set(null);
    this.fallbackErrorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.authService.login({
      email: this.email.value!,
      password: this.password.value!
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.error?.message) {
          this.serverErrorMessage.set(err.error.message);
        } else {
          this.fallbackErrorKey.set('auth.login.invalidCredentials');
        }
      }
    });
  }

}