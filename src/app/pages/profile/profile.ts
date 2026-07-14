import { Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
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
export class Profile implements OnDestroy {

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
  /** Object URL currently backing avatarUrl() - tracked so it can be revoked before the next one replaces it. */
  private avatarObjectUrl: string | null = null;
  private avatarPreviewUrl = signal<string | null>(null);
  private avatarBroken = signal(false);
  isUploadingAvatar = signal(false);
  /** Percentage (0-100) while the browser reports upload progress; null until the first event arrives. */
  uploadProgress = signal<number | null>(null);

  displayAvatarUrl = computed(() => this.avatarPreviewUrl() ?? this.avatarUrl());
  showAvatarImage = computed(() => !!this.displayAvatarUrl() && !this.avatarBroken());

  /** Fallback shown in place of a missing photo - initials read better than a generic icon. */
  private firstNameSig = signal('');
  private lastNameSig = signal('');
  avatarInitials = computed(() => {
    const initials = `${this.firstNameSig().charAt(0)}${this.lastNameSig().charAt(0)}`.toUpperCase();
    return initials || null;
  });

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
        this.firstNameSig.set(profile.firstName);
        this.lastNameSig.set(profile.lastName);
        this.avatarBroken.set(false);
        this.loadAvatar(profile.avatarUrl);
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
        this.firstNameSig.set(profile.firstName);
        this.lastNameSig.set(profile.lastName);
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

  ngOnDestroy(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
    }
  }

  /**
   * Avatar files live behind Bearer auth (see AuthService.fetchAvatarObjectUrl), so the URL
   * the server hands back can't be used as an <img src> directly - it has to be fetched with
   * the token and swapped for a local object URL first.
   */
  private loadAvatar(avatarPath: string | null | undefined): void {
    const resolvedUrl = resolveAvatarUrl(avatarPath);

    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }

    if (!resolvedUrl) {
      this.avatarUrl.set(null);
      return;
    }

    this.authService.fetchAvatarObjectUrl(resolvedUrl).subscribe({
      next: (objectUrl) => {
        this.avatarObjectUrl = objectUrl;
        this.avatarUrl.set(objectUrl);
      },
      error: () => {
        this.avatarUrl.set(null);
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
    this.uploadProgress.set(0);

    this.authService.uploadAvatar(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
        } else if (event.type === HttpEventType.Response && event.body) {
          this.isUploadingAvatar.set(false);
          this.uploadProgress.set(null);
          this.avatarPreviewUrl.set(null);
          URL.revokeObjectURL(previewUrl);
          this.loadAvatar(event.body.avatarUrl);
          this.successKey.set('profile.avatarUploadSuccess');
        }
      },
      error: (err) => {
        this.isUploadingAvatar.set(false);
        this.uploadProgress.set(null);
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