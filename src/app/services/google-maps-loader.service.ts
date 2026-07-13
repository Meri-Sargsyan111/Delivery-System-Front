import { Injectable } from '@angular/core';
import { GOOGLE_MAPS_API_KEY } from '../config/google-maps.config';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {

  private loadPromise: Promise<void> | null = null;

  load(): Promise<void> {

    if (typeof google !== 'undefined' && google.maps) {
      return Promise.resolve();
    }

    if (!this.loadPromise) {
      this.loadPromise = new Promise<void>((resolve, reject) => {

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps JavaScript API'));

        document.head.appendChild(script);
      });
    }

    return this.loadPromise;
  }

}