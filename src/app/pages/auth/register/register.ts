import { Component, inject, signal, computed } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, RegisterRole } from '../../../services/auth.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslationService } from '../../../i18n/translation.service';
import { PHONE_NUMBER_PATTERN } from '../../../utils/validators.util';

function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password && confirmPassword && password !== confirmPassword
    ? { passwordsMismatch: true }
    : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class Register {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private i18n = inject(TranslationService);

  readonly roleOptions: { value: RegisterRole; labelKey: string; icon: string }[] = [
    { value: 'CUSTOMER', labelKey: 'auth.register.customer', icon: 'bi-person' },
    { value: 'COURIER', labelKey: 'auth.register.courier', icon: 'bi-bicycle' }
  ];

  submitted = false;
  isSubmitting = signal(false);
  showPassword = signal(false);
  showConfirmPassword = signal(false);

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
    firstName: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    lastName: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    phoneNumber: this.fb.control('', [Validators.required, Validators.pattern(PHONE_NUMBER_PATTERN)]),
    password: this.fb.control('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: this.fb.control('', [Validators.required]),
    role: this.fb.control<RegisterRole>('CUSTOMER', { nonNullable: true, validators: [Validators.required] })
  }, { validators: passwordsMatchValidator });

  get firstName() {
    return this.form.controls.firstName;
  }

  get lastName() {
    return this.form.controls.lastName;
  }

  get email() {
    return this.form.controls.email;
  }

  get phoneNumber() {
    return this.form.controls.phoneNumber;
  }

  get password() {
    return this.form.controls.password;
  }

  get confirmPassword() {
    return this.form.controls.confirmPassword;
  }

  get role() {
    return this.form.controls.role;
  }

  selectRole(role: RegisterRole) {
    this.role.setValue(role);
  }

  togglePasswordVisibility() {
    this.showPassword.update(value => !value);
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.update(value => !value);
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

    this.authService.register({
      firstName: this.firstName.value!,
      lastName: this.lastName.value!,
      email: this.email.value!,
      phoneNumber: this.phoneNumber.value!,
      password: this.password.value!,
      confirmPassword: this.confirmPassword.value!,
      role: this.role.value
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        if (err.error?.message) {
          this.serverErrorMessage.set(err.error.message);
        } else {
          this.fallbackErrorKey.set('auth.register.registrationFailed');
        }
      }
    });
  }

}