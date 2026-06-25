import { AfterViewInit, Component, OnDestroy } from '@angular/core';
import * as L from 'leaflet';
import {
  CourierLocation,
  LocationWebSocketService
} from '../../services/location-websocket.service';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

@Component({
  selector: 'app-live-tracking',
  standalone: true,
  templateUrl: './live-tracking.html',
  styleUrls: ['./live-tracking.css']
})
export class LiveTracking implements AfterViewInit, OnDestroy {

  private map!: L.Map;
  private courierMarker!: L.Marker;

  constructor(
    private locationWebSocketService: LocationWebSocketService
  ) {}

  ngAfterViewInit(): void {

    this.map = L.map('map').setView([40.1772, 44.5035], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.courierMarker = L.marker([40.1772, 44.5035])
      .addTo(this.map)
      .bindPopup('🚚 Courier')
      .openPopup();

    this.locationWebSocketService.connect((location: CourierLocation) => {

      console.log('📍 Location:', location);

      this.moveCourier(
        location.latitude,
        location.longitude
      );

    });
  }

  private moveCourier(latitude: number, longitude: number): void {

    console.log('Moving marker to:', latitude, longitude);

    this.courierMarker.setLatLng([latitude, longitude]);

    this.map.flyTo([latitude, longitude], this.map.getZoom(), {
      animate: true,
      duration: 1
    });

  }

  ngOnDestroy(): void {
    this.locationWebSocketService.disconnect();
  }
}
