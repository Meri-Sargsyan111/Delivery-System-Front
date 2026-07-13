import { Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, resolveAvatarUrl } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';
import { roleTranslationKey } from '../../i18n/status-labels';
import { PHONE_NUMBER_PATTERN } from '../../utils/validators.util';

const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png'];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class Profile {

  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private i18n = inject(TranslationService);

  submitted = false;
  isLoading = signal(true);
  isSaving = signal(false);

  email = '';
  private role = signal<string | null>(null);
  roleKey = computed(() => roleTranslationKey(this.role()));

  /**
   * A backend-supplied message is raw text and must never be translated. A frontend
   * fallback, however, must stay reactive to a later language switch - so it's kept as a
   * translation key here and only resolved to text inside this computed, which re-runs
   * whenever the active language changes (unlike a plain string captured once at error time).
   */
  private serverErrorMessage = signal<string | null>(null);
  private fallbackErrorKey = signal<string | null>(null);
  errorMessage = computed(() => this.serverErrorMessage() ?? (this.fallbackErrorKey() ? this.i18n.t(this.fallbackErrorKey()!) : null));

  /** Shared by both the profile-save and avatar-upload flows - each just sets its own key. */
  private successKey = signal<string | null>(null);
  successMessage = computed(() => this.successKey() ? this.i18n.t(this.successKey()!) : null);

  @ViewChild('avatarInput') private avatarInput?: ElementRef<HTMLInputElement>;

  private avatarUrl = signal<string | null>(null);
  private avatarPreviewUrl = signal<string | null>(null);
  private avatarBroken = signal(false);
  isUploadingAvatar = signal(false);

  displayAvatarUrl = computed(() => this.avatarPreviewUrl() ?? this.avatarUrl());
  showAvatarImage = computed(() => !!this.displayAvatarUrl() && !this.avatarBroken());

  form = this.fb.group({
    firstName: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    lastName: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    phoneNumber: this.fb.control('', [Validators.required, Validators.pattern(PHONE_NUMBER_PATTERN)])
  });

  get firstName() {
    return this.form.controls.firstName;
  }

  get lastName() {
    return this.form.controls.lastName;
  }

  get phoneNumber() {
    return this.form.controls.phoneNumber;
  }

  constructor() {
    this.loadProfile();
  }

  loadProfile() {
    this.isLoading.set(true);
    this.serverErrorMessage.set(null);
    this.fallbackErrorKey.set(null);

    this.authService.getProfile().subscribe({
      next: (profile) => {
        this.email = profile.email;
        this.role.set(profile.role);
        this.form.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phoneNumber: profile.phoneNumber
        });
        this.avatarBroken.set(false);
        this.avatarUrl.set(resolveAvatarUrl(profile.avatarUrl));
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.error?.message) {
          this.serverErrorMessage.set(err.error.message);
        } else {
          this.fallbackErrorKey.set('profile.loadError');
        }
      }
    });
  }

  onSubmit() {
    this.submitted = true;
    this.serverErrorMessage.set(null);
    this.fallbackErrorKey.set(null);
    this.successKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    this.authService.updateProfile({
      firstName: this.firstName.value!,
      lastName: this.lastName.value!,
      phoneNumber: this.phoneNumber.value!
    }).subscribe({
      next: (profile) => {
        this.isSaving.set(false);
        this.email = profile.email;
        this.role.set(profile.role);
        this.form.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          phoneNumber: profile.phoneNumber
        });
        this.submitted = false;
        this.successKey.set('profile.updateSuccess');
      },
      error: (err) => {
        this.isSaving.set(false);
        if (err.error?.message) {
          this.serverErrorMessage.set(err.error.message);
        } else {
          this.fallbackErrorKey.set('profile.updateError');
        }
      }
    });
  }

  openAvatarPicker(): void {
    if (this.isUploadingAvatar()) {
      return;
    }
    this.avatarInput?.nativeElement.click();
  }

  onAvatarError(): void {
    this.avatarBroken.set(true);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file) {
      return;
    }

    this.serverErrorMessage.set(null);
    this.fallbackErrorKey.set(null);
    this.successKey.set(null);

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      this.fallbackErrorKey.set('profile.avatarInvalidType');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      this.fallbackErrorKey.set('profile.avatarTooLarge');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    this.avatarBroken.set(false);
    this.avatarPreviewUrl.set(previewUrl);
    this.isUploadingAvatar.set(true);

    this.authService.uploadAvatar(file).subscribe({
      next: (profile) => {
        this.isUploadingAvatar.set(false);
        this.avatarPreviewUrl.set(null);
        URL.revokeObjectURL(previewUrl);
        this.avatarUrl.set(resolveAvatarUrl(profile.avatarUrl));
        this.successKey.set('profile.avatarUploadSuccess');
      },
      error: (err) => {
        this.isUploadingAvatar.set(false);
        this.avatarPreviewUrl.set(null);
        URL.revokeObjectURL(previewUrl);
        if (err.error?.message) {
          this.serverErrorMessage.set(err.error.message);
        } else {
          this.fallbackErrorKey.set('profile.avatarUploadError');
        }
      }
    });
  }

}