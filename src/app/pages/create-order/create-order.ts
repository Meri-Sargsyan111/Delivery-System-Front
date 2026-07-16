import { Component, OnInit, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { OrderService } from '../../services/order.service';
import { Customer, CustomerService } from '../../services/customer.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';

const PHONE_ALLOWED_CHARS_PATTERN = /^\+?[0-9\s()-]+$/;
const PHONE_MIN_DIGITS = 6;

function phoneNumberValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (!value) {
    return null;
  }

  if (!PHONE_ALLOWED_CHARS_PATTERN.test(value)) {
    return { phoneFormat: true };
  }

  const digitCount = (value.match(/\d/g) ?? []).length;

  if (digitCount < PHONE_MIN_DIGITS) {
    return { phoneFormat: true };
  }

  return null;
}

@Component({
  selector: 'app-create-order',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './create-order.html',
  styleUrl: './create-order.css'
})
export class CreateOrder implements OnInit {

  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);
  private customerService = inject(CustomerService);
  private authService = inject(AuthService);
  private i18n = inject(TranslationService);

  /** The customer picker is an ADMIN-only concern - a CUSTOMER can only ever order for themselves. */
  isAdmin = this.authService.isAdmin;

  submitted = false;
  isSubmitting = signal(false);
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  customers = signal<Customer[]>([]);
  customersLoading = signal(false);
  customersError = signal<string | null>(null);

  form = this.fb.group({
    customerId: this.fb.control<string | null>(null, this.isAdmin() ? [Validators.required] : []),
    customerPhone: this.fb.control('', [Validators.required, Validators.maxLength(20), phoneNumberValidator]),
    fromAddress: this.fb.control('', [Validators.required]),
    toAddress: this.fb.control('', [Validators.required])
  });

  get customerId() {
    return this.form.controls.customerId;
  }

  get customerPhone() {
    return this.form.controls.customerPhone;
  }

  get fromAddress() {
    return this.form.controls.fromAddress;
  }

  get toAddress() {
    return this.form.controls.toAddress;
  }

  ngOnInit() {
    if (this.isAdmin()) {
      this.loadCustomers();
    }
  }

  private loadCustomers() {
    this.customersLoading.set(true);
    this.customersError.set(null);

    this.customerService.getCustomers().subscribe({
      next: (customers) => {
        this.customersLoading.set(false);
        this.customers.set(customers);
      },
      error: () => {
        this.customersLoading.set(false);
        this.customersError.set(this.i18n.t('createOrder.customersLoadError'));
      }
    });
  }

  onSubmit() {
    this.submitted = true;
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const customerId = this.isAdmin() ? this.customerId.value! : this.authService.currentUser()!.sub;

    this.orderService.createOrder({
      customerId,
      customerPhone: this.customerPhone.value!,
      fromAddress: this.fromAddress.value!,
      toAddress: this.toAddress.value!
    }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.successMessage.set(this.i18n.t('createOrder.success'));
        this.submitted = false;
        this.form.reset();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.message ?? this.i18n.t('createOrder.error'));
      }
    });
  }

}
