import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TrackingService } from '../../services/tracking.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslationService } from '../../i18n/translation.service';
import { orderStatusKey } from '../../i18n/status-labels';

@Component({
  selector: 'app-tracking',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './tracking.html',
  styleUrl: './tracking.css'
})
export class Tracking {

  private trackingService = inject(TrackingService);
  private i18n = inject(TranslationService);

  readonly orderStatusKey = orderStatusKey;

  orderId = 0;
  events: any[] = [];

  trackOrder() {

      if (this.orderId <= 0) {
        alert(this.i18n.t('tracking.pleaseEnterOrderId'));
        return;
      }

      this.trackingService.getTrackingEvents(this.orderId).subscribe({
          next: (data) => {
            if (data.content) {
              this.events = data.content;
            } else {
              this.events = data;
            }

            if (this.events.length === 0) {
              alert(this.i18n.t('tracking.noTrackingEventsFound'));
            }
          },
          error: () => {
            alert(this.i18n.t('tracking.trackingError'));
          }
        });
    }
}
